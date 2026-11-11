"""Data source labels must reflect the actual candidate element provenance."""
from __future__ import annotations

from dataclasses import replace

from app import config
from app.catalog import seed_from_snapshot
from app.db import Database
from app.main import AppState


def test_mode_changes_from_archive_to_mixed_to_live():
    db = Database(":memory:")
    try:
        assert seed_from_snapshot(db)
        state = AppState(config.Settings(data_mode="live"), db, refresh=None)
        assert state.data_mode == "snapshot"
        rows = db.all_gp()
        candidates = [nid for nid, _, _ in db.candidate_set() if nid in rows]
        assert len(candidates) > 1

        first = rows[candidates[0]]
        db.upsert_gp(replace(first, source="live"))
        assert state.data_mode == "mixed"

        for nid in candidates[1:]:
            db.upsert_gp(replace(rows[nid], source="live"))
        assert state.data_mode == "live"
    finally:
        db.close()


def test_explicit_snapshot_mode_remains_archived():
    db = Database(":memory:")
    try:
        assert seed_from_snapshot(db)
        first = next(iter(db.all_gp().values()))
        db.upsert_gp(replace(first, source="live"))
        assert (
                AppState(config.Settings(data_mode="snapshot"), 
                         db, 
                         refresh=None, 
                         ).data_mode== "snapshot")
    finally:
        db.close()
