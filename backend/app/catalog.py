"""Candidate-set selection, snapshot seeding and live refresh."""
from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import asdict
from typing import Any

from . import config
from .celestrak import CelesTrakClient, CelesTrakError, parse_satcat_csv, validate_omm
from .db import Database, GpRow, SatcatRow, iso, parse_iso, utcnow
from .stories import stories_by_id

log = logging.getLogger("aboveus.catalog")


def is_candidate_eligible(row: SatcatRow) -> bool:
    """Structural rule for membership in the searched set (see docs/ARCHITECTURE.md §3)."""
    return row.object_type == "PAY" and row.orbit_center == "EA" and row.on_orbit


def select_candidates(rows: list[SatcatRow], curated_ids: set[int],
                      count: int = config.OLDEST_PAYLOAD_COUNT) -> list[tuple[int, str, int]]:
    """Return (norad_id, reason, rank) for the declared set, ranked by launch date."""
    eligible = sorted((r for r in rows if is_candidate_eligible(r)),
                      key=lambda r: (r.launch_date, r.norad_id))
    chosen: dict[int, str] = {r.norad_id: "oldest_payload" for r in eligible[:count]}
    for r in eligible[count:]:
        if r.norad_id in curated_ids:
            chosen[r.norad_id] = "curated"
    ordered = [r for r in eligible if r.norad_id in chosen]
    return [(r.norad_id, chosen[r.norad_id], i + 1) for i, r in enumerate(ordered)]


def rows_to_keep(rows: list[SatcatRow], candidates: list[tuple[int, str, int]],
                 curated_ids: set[int]) -> list[SatcatRow]:
    keep = {c[0] for c in candidates} | curated_ids
    return [r for r in rows if r.norad_id in keep]


# -- snapshot ---------------------------------------------------------------

def load_snapshot() -> dict[str, Any] | None:
    path = config.SNAPSHOT_DIR / "snapshot.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def seed_from_snapshot(db: Database) -> bool:
    """Fill an empty database from the bundled capture. Rows are marked source='snapshot'."""
    snap = load_snapshot()
    if snap is None:
        return False
    captured = snap["captured_at"]
    sat_rows = [SatcatRow(**{**r, "source": "snapshot", "retrieved_at": captured})
                for r in snap["satcat"]]
    db.upsert_satcat(sat_rows)
    for omm in snap["gp"]:
        nid = int(omm["NORAD_CAT_ID"])
        db.upsert_gp(GpRow(nid, omm["EPOCH"], omm, "snapshot", config.gp_url(nid), captured))
    for nid, detail in snap.get("gp_missing", {}).items():
        db.mark_gp_missing(int(nid), detail, "snapshot", captured)
    db.replace_candidate_set(select_candidates(sat_rows, set(stories_by_id())))
    db.set_meta("snapshot_captured_at", captured)
    db.set_meta("satcat_retrieved_at", captured)
    db.set_meta("satcat_source", "snapshot")
    db.bump_revision()
    return True


def build_snapshot(client: CelesTrakClient, spacing: float = config.GP_REQUEST_SPACING_SECONDS,
                   progress: Any = None) -> dict[str, Any]:
    """Capture SATCAT subset + GP elements from CelesTrak (used by scripts/build_snapshot.py)."""
    captured = iso(utcnow())
    rows = parse_satcat_csv(client.fetch_satcat_csv(), captured)
    curated = set(stories_by_id())
    candidates = select_candidates(rows, curated)
    kept = rows_to_keep(rows, candidates, curated)
    gp, missing = [], {}
    for i, (nid, _, _) in enumerate(candidates):
        res = client.fetch_gp(nid)
        if res.omm is None:
            missing[str(nid)] = res.detail
        else:
            gp.append(res.omm)
        if progress:
            progress(i + 1, len(candidates), nid)
        time.sleep(spacing)
    return {
        "captured_at": captured,
        "candidate_set_version": config.CANDIDATE_SET_VERSION,
        "sources": {"satcat": config.SATCAT_CSV_URL,
                    "gp": config.gp_url(0).replace("=0&", "={id}&")},
        "satcat": [{k: v for k, v in asdict(r).items() if k not in ("source", "retrieved_at")}
                   for r in kept],
        "gp": gp,
        "gp_missing": missing,
    }


# -- live refresh -----------------------------------------------------------

class RefreshService:
    """Keeps the cache current in a background thread. Never invents data on failure."""

    def __init__(self, db: Database, client: CelesTrakClient):
        self.db = db
        self.client = client
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self.state: dict[str, Any] = {
            "running": False, "last_started_at": None, "last_finished_at": None,
            "last_error": None, "gp_done": 0, "gp_total": 0,
        }

    def start_background(self) -> bool:
        with self._lock:
            if self._thread and self._thread.is_alive():
                return False
            self._stop.clear()
            self._thread = threading.Thread(target=self._loop, name="aboveus-refresh",
                                            daemon=True)
            self._thread.start()
            return True

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        """Re-check what is due every few minutes; TTLs decide what is actually fetched."""
        while not self._stop.is_set():
            self.run_once()
            troubled = self.state.get("last_error") is not None
            self._stop.wait(config.REFRESH_BACKOFF_SECONDS if troubled
                            else config.REFRESH_CHECK_SECONDS)

    def satcat_due(self) -> bool:
        if self.db.get_meta("satcat_source") != "live":
            return True
        at = self.db.get_meta("satcat_retrieved_at")
        return at is None or (utcnow() - parse_iso(at)).total_seconds() > config.SATCAT_TTL_SECONDS

    def gp_due(self, row: GpRow | None, missing: dict[str, str] | None) -> bool:
        if row is None and missing is None:
            return True
        source = row.source if row else missing["source"]  # type: ignore[index]
        at = row.retrieved_at if row else missing["checked_at"]  # type: ignore[index]
        if source != "live":
            return True
        return (utcnow() - parse_iso(at)).total_seconds() > config.GP_TTL_SECONDS

    def run_once(self, spacing: float = config.GP_REQUEST_SPACING_SECONDS) -> None:
        self.state.update(running=True, last_started_at=iso(utcnow()), last_error=None,
                          gp_done=0, gp_total=0)
        errors: list[str] = []
        try:
            if self.satcat_due():
                try:
                    self._refresh_satcat()
                except CelesTrakError as exc:
                    errors.append(str(exc))
            errors += self._refresh_gp(spacing)
        except Exception as exc:  # noqa: BLE001 - background thread must not die silently
            log.exception("refresh failed")
            errors.append(f"{type(exc).__name__}: {exc}")
        finally:
            self.state.update(
                running=False, last_finished_at=iso(utcnow()),
                last_error="; ".join(errors[:3]) + (f" (+{len(errors) - 3} more)"
                                                    if len(errors) > 3 else "") if errors else None,
            )

    def _refresh_satcat(self) -> None:
        now = iso(utcnow())
        rows = parse_satcat_csv(self.client.fetch_satcat_csv(), now)
        curated = set(stories_by_id())
        candidates = select_candidates(rows, curated)
        self.db.upsert_satcat(rows_to_keep(rows, candidates, curated))
        self.db.replace_candidate_set(candidates)
        self.db.set_meta("satcat_retrieved_at", now)
        self.db.set_meta("satcat_source", "live")
        self.db.bump_revision()

    def _refresh_gp(self, spacing: float) -> list[str]:
        gp, missing = self.db.all_gp(), self.db.gp_missing()
        due = [nid for nid, _, _ in self.db.candidate_set()
               if self.gp_due(gp.get(nid), missing.get(nid))]
        self.state["gp_total"] = len(due)
        errors: list[str] = []
        consecutive = 0
        for i, nid in enumerate(due):
            if self._stop.is_set():
                break
            try:
                res = self.client.fetch_gp(nid)
                now = iso(utcnow())
                if res.omm is None:
                    self.db.mark_gp_missing(nid, res.detail, "live", now)
                else:
                    validate_omm(res.omm, nid)
                    self.db.upsert_gp(GpRow(nid, res.omm["EPOCH"], res.omm, "live", res.url, now))
                consecutive = 0
            except CelesTrakError as exc:
                errors.append(str(exc))
                consecutive += 1
                if consecutive >= 5:  # upstream is down: stop hammering, keep cached rows
                    errors.append("aborted GP refresh after 5 consecutive failures")
                    break
            self.state["gp_done"] = i + 1
            if (i + 1) % 20 == 0:
                self.db.bump_revision()
            if i + 1 < len(due) and self._stop.wait(spacing):
                break
        if due:
            self.db.bump_revision()
        return errors
