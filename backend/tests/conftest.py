from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import config
from app.catalog import seed_from_snapshot
from app.db import Database, parse_iso
from app.main import create_app

KOLKATA = (22.5726, 88.3639)
LONDON = (51.5074, -0.1278)
SYDNEY = (-33.8688, 151.2093)
TROMSO = (69.6492, 18.9553)


@pytest.fixture(scope="session")
def db() -> Database:
    """In-memory cache seeded from the bundled CelesTrak capture (real, archived data)."""
    database = Database(":memory:")
    assert seed_from_snapshot(database), "bundled snapshot is missing"
    return database


@pytest.fixture(scope="session")
def t0(db):
    return parse_iso(db.get_meta("snapshot_captured_at"))


@pytest.fixture(scope="session")
def client(tmp_path_factory) -> TestClient:
    path: Path = tmp_path_factory.mktemp("db") / "test.sqlite3"
    app = create_app(config.Settings(data_mode="snapshot", db_path=path))
    with TestClient(app) as c:
        yield c
