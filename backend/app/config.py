"""Runtime configuration. Every scientific threshold lives here so it can be shown to users."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

DATA_DIR = Path(__file__).parent / "data"
SNAPSHOT_DIR = DATA_DIR / "snapshot"

DataMode = Literal["live", "snapshot"]

CANDIDATE_SET_VERSION = "heritage-v1"
OLDEST_PAYLOAD_COUNT = 120

# Elements older (or newer) than this relative to the window start are not propagated.
MAX_ELEMENT_AGE_DAYS = 30.0
# Freshness badge boundaries (days between element epoch and the window start).
FRESH_DAYS = 7.0

DEFAULT_MIN_ELEVATION_DEG = 10.0
DEFAULT_WINDOW_HOURS = 24.0
MAX_WINDOW_HOURS = 72.0

# CelesTrak asks clients not to re-request GP data more often than every 2 hours. Heritage
# objects get new element sets about once a day, so we stay well above that floor.
GP_TTL_SECONDS = 6 * 3600
SATCAT_TTL_SECONDS = 24 * 3600
GP_REQUEST_SPACING_SECONDS = 1.0
REFRESH_CHECK_SECONDS = 900
# After a run that hit repeated upstream failures, leave CelesTrak alone for this long.
REFRESH_BACKOFF_SECONDS = 3600
DISCOVERY_CACHE_SECONDS = 600

CELESTRAK_BASE = "https://celestrak.org"
SATCAT_CSV_URL = f"{CELESTRAK_BASE}/pub/satcat.csv"


def gp_url(norad_id: int) -> str:
    return f"{CELESTRAK_BASE}/NORAD/elements/gp.php?CATNR={norad_id}&FORMAT=JSON"


def satcat_record_url(norad_id: int) -> str:
    return f"{CELESTRAK_BASE}/satcat/records.php?CATNR={norad_id}"


@dataclass(frozen=True)
class Settings:
    data_mode: DataMode = "live"
    db_path: Path = field(default_factory=lambda: Path("var/aboveus.sqlite3"))
    cors_origins: tuple[str, ...] = ("http://localhost:3000", "http://127.0.0.1:3000")

    @classmethod
    def from_env(cls) -> Settings:
        mode = os.environ.get("ABOVEUS_DATA_MODE", "live").lower()
        if mode not in ("live", "snapshot"):
            raise ValueError("ABOVEUS_DATA_MODE must be 'live' or 'snapshot'")
        origins = os.environ.get("ABOVEUS_CORS_ORIGINS")
        return cls(
            data_mode=mode,  # type: ignore[arg-type]
            db_path=Path(os.environ.get("ABOVEUS_DB_PATH", "var/aboveus.sqlite3")),
            cors_origins=tuple(origins.split(",")) if origins else cls.cors_origins,
        )
