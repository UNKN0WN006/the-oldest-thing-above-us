from __future__ import annotations

import httpx
import pytest

from app.celestrak import CelesTrakClient, CelesTrakError, validate_omm
from app.db import Database

OMM = {"OBJECT_NAME": "VANGUARD 1", "OBJECT_ID": "1958-002B", "EPOCH": "2026-11-11T01:47:55.670496",
       "MEAN_MOTION": 10.86097552, "ECCENTRICITY": 0.18393485, "INCLINATION": 34.2431,
       "RA_OF_ASC_NODE": 220.9424, "ARG_OF_PERICENTER": 80.8648, "MEAN_ANOMALY": 299.4409,
       "EPHEMERIS_TYPE": 0, "CLASSIFICATION_TYPE": "U", "NORAD_CAT_ID": 5, "ELEMENT_SET_NO": 999,
       "REV_AT_EPOCH": 45925, "BSTAR": 0.00059844477, "MEAN_MOTION_DOT": 4.53e-6,
       "MEAN_MOTION_DDOT": 0}


def make(handler, db=None) -> CelesTrakClient:
    """Test double: a fake HTTP transport. No network is touched."""
    return CelesTrakClient(db, transport=httpx.MockTransport(handler), backoff_seconds=0)


def test_fetch_gp_returns_validated_omm():
    client = make(lambda req: httpx.Response(200, json=[OMM]))
    result = client.fetch_gp(5)
    assert result.omm["NORAD_CAT_ID"] == 5 and "CATNR=5" in result.url


def test_no_gp_data_is_a_result_not_an_error():
    client = make(lambda req: httpx.Response(404, text="No GP data found"))
    result = client.fetch_gp(635)
    assert result.omm is None and result.detail == "No GP data found"


def test_transient_failures_are_retried_and_logged():
    calls = []
    db = Database(":memory:")

    def handler(req):
        calls.append(1)
        if len(calls) < 3:
            raise httpx.ReadError("connection reset by peer")
        return httpx.Response(200, json=[OMM])

    assert make(handler, db).fetch_gp(5).omm is not None
    assert len(calls) == 3
    assert db.last_fetch("gp", ok=False)["detail"].startswith("ReadError")
    assert db.last_fetch("gp", ok=True)["status"] == 200


def test_server_errors_exhaust_retries_then_raise():
    calls = []

    def handler(req):
        calls.append(1)
        return httpx.Response(500, text="boom")

    with pytest.raises(CelesTrakError, match="HTTP 500"):
        make(handler).fetch_gp(5)
    assert len(calls) == 4


def test_client_errors_are_not_retried():
    calls = []

    def handler(req):
        calls.append(1)
        return httpx.Response(403, text="Forbidden")

    with pytest.raises(CelesTrakError):
        make(handler).fetch_gp(5)
    assert len(calls) == 1


@pytest.mark.parametrize("patch", [
    {"NORAD_CAT_ID": 6}, {"ECCENTRICITY": 1.2}, {"MEAN_MOTION": 0},
])
def test_validate_omm_rejects_wrong_or_unphysical_records(patch):
    with pytest.raises(CelesTrakError):
        validate_omm({**OMM, **patch}, 5)


@pytest.mark.parametrize("patch", [
    {"MEAN_MOTION": "nan"}, {"ECCENTRICITY": "not-a-number"},
    {"NORAD_CAT_ID": "invalid"}, {"INCLINATION": 190},
    {"BSTAR": float("inf")},
])
def test_validate_omm_rejects_non_finite_or_malformed_values(patch):
    with pytest.raises(CelesTrakError):
        validate_omm({**OMM, **patch}, 5)


def test_validate_omm_rejects_missing_fields():
    broken = {k: v for k, v in OMM.items() if k != "BSTAR"}
    with pytest.raises(CelesTrakError, match="BSTAR"):
        validate_omm(broken, 5)


def test_unparseable_answer_raises():
    with pytest.raises(CelesTrakError, match="non-JSON"):
        make(lambda req: httpx.Response(200, text="<html>maintenance</html>")).fetch_gp(5)
