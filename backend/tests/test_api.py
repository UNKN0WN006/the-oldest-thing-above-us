"""Integration tests: the real app, the real pass engine, the bundled (archived) capture."""
from __future__ import annotations

from datetime import datetime, timedelta

from .conftest import KOLKATA

API = "/api/v1"


def discover(client, **overrides):
    body = {"observer": {"latitude_deg": KOLKATA[0], "longitude_deg": KOLKATA[1],
                         "place_name": "Kolkata"}}
    body.update(overrides)
    return client.post(f"{API}/discover", json=body)


def test_health(client):
    assert client.get(f"{API}/health").json() == {"status": "ok"}


def test_status_labels_archived_data_as_demonstration(client):
    s = client.get(f"{API}/status").json()
    assert s["data_mode"] == "snapshot"
    assert s["data_mode_label"].startswith("Demonstration")
    assert s["elements_live"] == 0 and s["elements_snapshot"] > 100
    assert s["refresh"] is None  # snapshot mode never contacts CelesTrak
    assert s["default_window_start"] == s["snapshot_captured_at"]
    assert s["candidate_count"] == s["elements_snapshot"] + s["elements_missing"]
    assert s["oldest_element_epoch"] <= s["newest_element_epoch"]


def test_cities_search_is_accent_and_case_insensitive(client):
    names = [c["name"] for c in client.get(f"{API}/cities", params={"q": "kol"}).json()["items"]]
    assert names[0] == "Kolkata"
    assert client.get(f"{API}/cities", params={"q": "sao"}).json()["items"][0]["name"] \
        == "São Paulo"
    assert client.get(f"{API}/cities", params={"q": "zzzz"}).json()["items"] == []
    assert len(client.get(f"{API}/cities").json()["items"]) > 50


def test_discover_contract(client):
    r = discover(client)
    assert r.status_code == 200
    d = r.json()
    assert d["data_mode"] == "snapshot"
    assert d["observer"]["place_name"] == "Kolkata"
    start = datetime.fromisoformat(d["window_start"])
    assert datetime.fromisoformat(d["window_end"]) - start == timedelta(hours=24)
    assert d["oldest"]["satellite"]["norad_id"] == 5
    assert d["oldest"]["satellite"]["launch_date_verification"] == "satcat+curated"
    first = d["oldest"]["passes"][0]
    assert first["track"] and first["illumination"] in (
        "dark_sky_sunlit", "twilight_sunlit", "daylight", "eclipsed")
    assert first["start"]["compass"]
    assert any("does not mean the object will be visible" in text for text in d["limitations"])
    assert d["methodology"]["candidate_set_version"] == "heritage-v1"
    assert {s["publisher"] for s in d["sources"]} == {"CelesTrak"}
    for c in d["candidates"]:
        assert c["provenance"]["element_epoch"] and c["provenance"]["retrieved_at"]


def test_discover_honours_window_and_threshold(client):
    d = discover(client, hours=2, min_elevation_deg=30).json()
    start = datetime.fromisoformat(d["window_start"])
    for c in d["candidates"]:
        for p in c["passes"]:
            assert p["culmination"]["elevation_deg"] >= 30
            assert start <= datetime.fromisoformat(p["start"]["time"])
            assert datetime.fromisoformat(p["end"]["time"]) <= start + timedelta(hours=2)


def test_discover_accepts_explicit_start(client):
    start = client.get(f"{API}/status").json()["default_window_start"]
    later = (datetime.fromisoformat(start) + timedelta(hours=6)).isoformat()
    d = discover(client, start=later).json()
    assert datetime.fromisoformat(d["window_start"]) == datetime.fromisoformat(later)


def test_validation_errors_use_the_error_envelope(client):
    r = discover(client, observer={"latitude_deg": 123, "longitude_deg": 0})
    assert r.status_code == 422
    err = r.json()["error"]
    assert err["code"] == "invalid_request"
    assert err["details"][0]["field"] == "observer.latitude_deg"
    assert discover(client, hours=500).status_code == 422
    assert discover(client, min_elevation_deg=-5).status_code == 422
    assert client.post(f"{API}/discover", json={}).status_code == 422
    assert discover(client, surprise=True).status_code == 422


def test_satellite_detail_has_story_elements_and_sources(client):
    d = client.get(f"{API}/satellites/5").json()
    assert d["satellite"]["display_name"] == "Vanguard 1"
    assert d["story"]["editorial_status"] == "draft"
    assert d["story"]["timeline"][0]["date"] == "1958-03-17"
    e = d["elements"]
    assert e["tle_line1"].startswith("1 00005U")
    assert 600 < e["perigee_km"] < 700 and 3700 < e["apogee_km"] < 3900
    assert e["provenance"]["source"] == "snapshot"
    kinds = {s["kind"] for s in d["sources"]}
    assert kinds == {"orbital_data", "catalogue", "mission_record"}
    assert all(s["url"].startswith("https://") for s in d["sources"])


def test_reentered_satellite_has_story_but_no_elements(client):
    d = client.get(f"{API}/satellites/2").json()  # Sputnik 1
    assert d["satellite"]["on_orbit"] is False and d["satellite"]["decay_date"]
    assert d["elements"] is None and "no longer in orbit" in d["elements_unavailable_reason"]
    assert d["satellite"]["in_candidate_set"] is False


def test_unknown_satellite_is_404_with_envelope(client):
    r = client.get(f"{API}/satellites/99999")
    assert r.status_code == 404 and r.json()["error"]["code"] == "satellite_not_found"
    assert client.get(f"{API}/satellites/abc").status_code == 422
    assert client.get(f"{API}/nope").json()["error"]["code"] == "http_error"


def test_passes_endpoint_matches_discover(client):
    oldest = discover(client).json()["oldest"]
    r = client.get(f"{API}/satellites/5/passes",
                   params={"lat": KOLKATA[0], "lon": KOLKATA[1]}).json()
    assert r["not_computed_reason"] is None
    assert [p["culmination"] for p in r["passes"]] == [p["culmination"] for p in oldest["passes"]]


def test_passes_endpoint_explains_why_nothing_was_computed(client):
    r = client.get(f"{API}/satellites/635/passes", params={"lat": 0, "lon": 0}).json()
    assert r["passes"] == [] and r["not_computed_reason"] == "no_elements"
    r = client.get(f"{API}/satellites/5/passes", params={"lat": 69.6, "lon": 18.9}).json()
    assert r["passes"] == [] and r["not_computed_reason"] == "no_pass"
    assert client.get(f"{API}/satellites/5/passes", params={"lat": 95, "lon": 0}).status_code == 422


def test_satellite_list_is_the_declared_set_in_launch_order(client):
    d = client.get(f"{API}/satellites").json()
    dates = [i["satellite"]["launch_date"] for i in d["items"]]
    assert dates == sorted(dates) and len(dates) >= 120
    assert all(i["satellite"]["in_candidate_set"] for i in d["items"])
    without = [i for i in d["items"] if i["provenance"] is None]
    assert all(i["tle_line1"] is None for i in without) and len(without) == 3


def test_graveyard_separates_orbiting_from_reentered(client):
    g = client.get(f"{API}/graveyard").json()
    assert all(e["satellite"]["on_orbit"] for e in g["still_orbiting"])
    assert all(e["satellite"]["decay_date"] for e in g["reentered"])
    names = {e["satellite"]["display_name"] for e in g["reentered"]}
    assert {"Sputnik 1", "Skylab", "Aryabhata", "Mir"} <= names
    active = {e["satellite"]["norad_id"] for e in g["still_orbiting"]}
    assert 25544 not in active and 20580 not in active  # working spacecraft are not graves
    sputnik = next(e for e in g["reentered"] if e["satellite"]["norad_id"] == 2)
    assert 0.2 < sputnik["years_in_orbit"] < 0.3


def test_methodology_document(client):
    m = client.get(f"{API}/methodology").json()
    assert set(m["exclusion_reasons"]) == {"no_elements", "stale_elements", "propagation_error",
                                           "no_pass"}
    assert m["methodology"]["max_element_age_days"] == 30
    assert "PyEphem" in m["validation_summary"]


def test_openapi_schema_is_served(client):
    schema = client.get("/openapi.json").json()
    assert "/api/v1/discover" in schema["paths"]
    assert "DiscoverResponse" in schema["components"]["schemas"]
