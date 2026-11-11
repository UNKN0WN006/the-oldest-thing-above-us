"""SQLite cache for CelesTrak data. Small on purpose: one writer, many readers."""
from __future__ import annotations

import json
import sqlite3
import threading
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS satcat (
  norad_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  cospar_id TEXT NOT NULL,
  object_type TEXT NOT NULL,
  ops_status TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  launch_date TEXT NOT NULL,
  launch_site TEXT NOT NULL DEFAULT '',
  decay_date TEXT,
  period_min REAL,
  inclination_deg REAL,
  apogee_km REAL,
  perigee_km REAL,
  orbit_center TEXT NOT NULL DEFAULT '',
  orbit_type TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL CHECK (source IN ('live','snapshot')),
  source_url TEXT NOT NULL,
  retrieved_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gp_elements (
  norad_id INTEGER PRIMARY KEY,
  epoch TEXT NOT NULL,
  omm_json TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('live','snapshot')),
  source_url TEXT NOT NULL,
  retrieved_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gp_missing (
  norad_id INTEGER PRIMARY KEY,
  detail TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('live','snapshot')),
  checked_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS candidate_set (
  norad_id INTEGER PRIMARY KEY,
  reason TEXT NOT NULL CHECK (reason IN ('oldest_payload','curated')),
  rank INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS fetch_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource TEXT NOT NULL,
  url TEXT NOT NULL,
  ok INTEGER NOT NULL,
  status INTEGER,
  detail TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


def utcnow() -> datetime:
    return datetime.now(UTC)


def iso(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(text: str) -> datetime:
    dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


@dataclass(frozen=True)
class SatcatRow:
    norad_id: int
    name: str
    cospar_id: str
    object_type: str
    ops_status: str
    owner: str
    launch_date: str
    launch_site: str
    decay_date: str | None
    period_min: float | None
    inclination_deg: float | None
    apogee_km: float | None
    perigee_km: float | None
    orbit_center: str
    orbit_type: str
    source: str
    source_url: str
    retrieved_at: str

    @property
    def on_orbit(self) -> bool:
        return not self.decay_date and self.orbit_type == "ORB"


@dataclass(frozen=True)
class GpRow:
    norad_id: int
    epoch: str
    omm: dict[str, Any]
    source: str
    source_url: str
    retrieved_at: str


class Database:
    def __init__(self, path: Path | str):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        with self._lock:
            self._conn.executescript(SCHEMA)
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    # -- meta ---------------------------------------------------------------
    def get_meta(self, key: str) -> str | None:
        with self._lock:
            row = self._conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return row["value"] if row else None

    def set_meta(self, key: str, value: str) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO meta(key,value) VALUES(?,?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, value),
            )
            self._conn.commit()

    def bump_revision(self) -> int:
        """Monotonic counter used to invalidate computed-result caches."""
        rev = int(self.get_meta("data_revision") or 0) + 1
        self.set_meta("data_revision", str(rev))
        return rev

    def revision(self) -> int:
        return int(self.get_meta("data_revision") or 0)

    # -- satcat -------------------------------------------------------------
    def upsert_satcat(self, rows: Iterable[SatcatRow]) -> None:
        cols = list(SatcatRow.__dataclass_fields__)
        sql = (
            f"INSERT OR REPLACE INTO satcat({','.join(cols)}) "
            f"VALUES({','.join('?' for _ in cols)})"
        )
        with self._lock:
            self._conn.executemany(sql, [tuple(getattr(r, c) for c in cols) for r in rows])
            self._conn.commit()

    def get_satcat(self, norad_id: int) -> SatcatRow | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM satcat WHERE norad_id=?", (norad_id,)
            ).fetchone()
        return SatcatRow(**dict(row)) if row else None

    def all_satcat(self) -> list[SatcatRow]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM satcat ORDER BY launch_date, norad_id"
            ).fetchall()
        return [SatcatRow(**dict(r)) for r in rows]

    # -- gp -----------------------------------------------------------------
    def upsert_gp(self, row: GpRow) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO gp_elements"
                "(norad_id,epoch,omm_json,source,source_url,retrieved_at) VALUES(?,?,?,?,?,?)",
                (row.norad_id, row.epoch, json.dumps(row.omm), row.source, row.source_url,
                 row.retrieved_at),
            )
            self._conn.execute("DELETE FROM gp_missing WHERE norad_id=?", (row.norad_id,))
            self._conn.commit()

    def get_gp(self, norad_id: int) -> GpRow | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM gp_elements WHERE norad_id=?", (norad_id,)
            ).fetchone()
        return self._gp(row) if row else None

    def all_gp(self) -> dict[int, GpRow]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM gp_elements").fetchall()
        return {r["norad_id"]: self._gp(r) for r in rows}

    @staticmethod
    def _gp(row: sqlite3.Row) -> GpRow:
        return GpRow(row["norad_id"], row["epoch"], json.loads(row["omm_json"]), row["source"],
                     row["source_url"], row["retrieved_at"])

    def mark_gp_missing(self, norad_id: int, detail: str, source: str, checked_at: str) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO gp_missing(norad_id,detail,source,checked_at) "
                "VALUES(?,?,?,?)",
                (norad_id, detail, source, checked_at),
            )
            self._conn.commit()

    def gp_missing(self) -> dict[int, dict[str, str]]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM gp_missing").fetchall()
        return {r["norad_id"]: dict(r) for r in rows}

    # -- candidate set ------------------------------------------------------
    def replace_candidate_set(self, entries: list[tuple[int, str, int]]) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM candidate_set")
            self._conn.executemany(
                "INSERT INTO candidate_set(norad_id,reason,rank) VALUES(?,?,?)", entries
            )
            self._conn.commit()

    def candidate_set(self) -> list[tuple[int, str, int]]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT norad_id, reason, rank FROM candidate_set ORDER BY rank"
            ).fetchall()
        return [(r["norad_id"], r["reason"], r["rank"]) for r in rows]

    # -- fetch log ----------------------------------------------------------
    def log_fetch(self, resource: str, url: str, ok: bool, status: int | None, detail: str,
                  started_at: datetime, duration_ms: int) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO fetch_log(resource,url,ok,status,detail,started_at,duration_ms) "
                "VALUES(?,?,?,?,?,?,?)",
                (resource, url, int(ok), status, detail[:500], iso(started_at), duration_ms),
            )
            self._conn.execute(
                "DELETE FROM fetch_log WHERE id <= (SELECT MAX(id) FROM fetch_log) - 2000"
            )
            self._conn.commit()

    def last_fetch(self, resource: str, ok: bool | None = None) -> dict[str, Any] | None:
        sql = "SELECT * FROM fetch_log WHERE resource=?"
        args: list[Any] = [resource]
        if ok is not None:
            sql += " AND ok=?"
            args.append(int(ok))
        with self._lock:
            row = self._conn.execute(sql + " ORDER BY id DESC LIMIT 1", args).fetchone()
        return dict(row) if row else None
