"""Live checks against celestrak.org. Run with:  pytest -m live"""
from __future__ import annotations

from datetime import timedelta

import pytest

from app.celestrak import CelesTrakClient
from app.db import parse_iso, utcnow
from app.passes import Observer, find_passes, satellite_from_omm

pytestmark = pytest.mark.live


def test_live_gp_fetch_is_recent_and_propagates():
    client = CelesTrakClient()
    try:
        result = client.fetch_gp(25544)
    finally:
        client.close()
    assert result.omm is not None
    age = utcnow() - parse_iso(result.omm["EPOCH"])
    assert age < timedelta(days=7), "ISS elements are normally refreshed several times a day"
    now = utcnow()
    passes = find_passes(satellite_from_omm(result.omm), Observer(22.5726, 88.3639), now,
                         now + timedelta(hours=48), 10.0)
    assert passes


def test_live_object_without_gp_data():
    client = CelesTrakClient()
    try:
        assert client.fetch_gp(692).omm is None  # Vela 1: catalogued, no public elements
    finally:
        client.close()
