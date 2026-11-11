"""Polite CelesTrak client: retries transient failures, never retries policy answers."""
from __future__ import annotations

import csv
import io
import math
import time
from dataclasses import dataclass
from typing import Any

import httpx

from . import config
from .db import Database, SatcatRow, utcnow

USER_AGENT = "AboveUs/0.1 (educational satellite-history project)"


class CelesTrakError(RuntimeError):
    """The upstream could not be reached or answered with something unusable."""


@dataclass(frozen=True)
class GpResult:
    norad_id: int
    omm: dict[str, Any] | None  # None: CelesTrak has no GP data for this object
    detail: str
    url: str


REQUIRED_OMM_FIELDS = (
    "EPOCH", "MEAN_MOTION", "ECCENTRICITY", "INCLINATION", "RA_OF_ASC_NODE",
    "ARG_OF_PERICENTER", "MEAN_ANOMALY", "NORAD_CAT_ID", "BSTAR",
)


def validate_omm(omm: dict[str, Any], norad_id: int) -> None:
    missing = [f for f in REQUIRED_OMM_FIELDS if f not in omm]
    if missing:
        raise CelesTrakError(f"GP record for {norad_id} lacks fields: {', '.join(missing)}")
    try:
        record_id = int(omm["NORAD_CAT_ID"])
        numbers = {key: float(omm[key]) for key in (
            "ECCENTRICITY", "MEAN_MOTION", "INCLINATION", "RA_OF_ASC_NODE",
            "ARG_OF_PERICENTER", "MEAN_ANOMALY", "BSTAR",
        )}
    except (ValueError, TypeError, OverflowError) as exc:
        raise CelesTrakError(f"GP record for {norad_id} has invalid numeric fields") from exc
    if record_id != norad_id:
        raise CelesTrakError(f"GP record id {record_id} does not match {norad_id}")
    if not all(math.isfinite(value) for value in numbers.values()):
        raise CelesTrakError(f"GP record for {norad_id} has non-finite orbital elements")
    if (not 0 <= numbers["ECCENTRICITY"] < 1 or numbers["MEAN_MOTION"] <= 0
            or not 0 <= numbers["INCLINATION"] <= 180):
        raise CelesTrakError(f"GP record for {norad_id} has non-physical elements")


def _num(text: str) -> float | None:
    try:
        return float(text) if text not in ("", None) else None
    except ValueError:
        return None


def parse_satcat_csv(text: str, retrieved_at: str, source: str = "live") -> list[SatcatRow]:
    rows = []
    for r in csv.DictReader(io.StringIO(text)):
        try:
            norad = int(r["NORAD_CAT_ID"])
        except (KeyError, ValueError):
            continue
        if not r.get("LAUNCH_DATE"):
            continue
        rows.append(SatcatRow(
            norad_id=norad, name=r["OBJECT_NAME"].strip(), cospar_id=r["OBJECT_ID"],
            object_type=r["OBJECT_TYPE"], ops_status=r.get("OPS_STATUS_CODE", ""),
            owner=r.get("OWNER", ""), launch_date=r["LAUNCH_DATE"],
            launch_site=r.get("LAUNCH_SITE", ""), decay_date=r.get("DECAY_DATE") or None,
            period_min=_num(r.get("PERIOD", "")), inclination_deg=_num(r.get("INCLINATION", "")),
            apogee_km=_num(r.get("APOGEE", "")), perigee_km=_num(r.get("PERIGEE", "")),
            orbit_center=r.get("ORBIT_CENTER", ""), orbit_type=r.get("ORBIT_TYPE", ""),
            source=source, source_url=config.SATCAT_CSV_URL, retrieved_at=retrieved_at,
        ))
    if not rows:
        raise CelesTrakError("SATCAT download contained no usable rows")
    return rows


class CelesTrakClient:
    def __init__(self, db: Database | None = None, transport: httpx.BaseTransport | None = None,
                 retries: int = 3, backoff_seconds: float = 1.5):
        self._db = db
        self._retries = retries
        self._backoff = backoff_seconds
        self._http = httpx.Client(
            transport=transport, timeout=httpx.Timeout(60.0, connect=15.0),
            headers={"User-Agent": USER_AGENT}, follow_redirects=True,
        )

    def close(self) -> None:
        self._http.close()

    def _get(self, resource: str, url: str, accept: tuple[int, ...] = (200,)) -> httpx.Response:
        last_error = "unknown error"
        for attempt in range(self._retries + 1):
            started = utcnow()
            t0 = time.monotonic()
            status: int | None = None
            try:
                resp = self._http.get(url)
                status = resp.status_code
                if status in accept:
                    self._log(resource, url, True, status, "", started, t0)
                    return resp
                last_error = f"HTTP {status}"
                retryable = status >= 500 or status == 429
            except httpx.HTTPError as exc:
                last_error = f"{type(exc).__name__}: {exc}"
                # A proxy/policy refusal (403/407 on CONNECT) will not get better by retrying.
                retryable = "403" not in str(exc) and "407" not in str(exc)
            self._log(resource, url, False, status, last_error, started, t0)
            if not retryable or attempt == self._retries:
                break
            time.sleep(self._backoff * (2 ** attempt))
        raise CelesTrakError(f"{resource}: {last_error} ({url})")

    def _log(self, resource: str, url: str, ok: bool, status: int | None, detail: str,
             started: Any, t0: float) -> None:
        if self._db is not None:
            self._db.log_fetch(resource, url, ok, status, detail, started,
                               int((time.monotonic() - t0) * 1000))

    def fetch_satcat_csv(self) -> str:
        return self._get("satcat", config.SATCAT_CSV_URL).text

    def fetch_gp(self, norad_id: int) -> GpResult:
        url = config.gp_url(norad_id)
        # CelesTrak answers 404 "No GP data found" for objects without public elements.
        resp = self._get("gp", url, accept=(200, 404))
        body = resp.text.strip()
        if body.startswith("No GP data found"):
            return GpResult(norad_id, None, body, url)
        if resp.status_code != 200:
            raise CelesTrakError(f"gp: HTTP {resp.status_code} for {norad_id}: {body[:80]}")
        try:
            data = resp.json()
        except ValueError as exc:
            raise CelesTrakError(f"gp: non-JSON answer for {norad_id}: {body[:80]}") from exc
        if not isinstance(data, list) or not data:
            return GpResult(norad_id, None, "empty GP answer", url)
        validate_omm(data[0], norad_id)
        return GpResult(norad_id, data[0], "", url)
