from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from skyfield.api import wgs84

from app.passes import (
    TS,
    Observer,
    PropagationError,
    compass,
    find_passes,
    satellite_from_omm,
    subpoint,
    tle_lines,
)
from app.sun import classify_illumination, sun_altitude_deg

from .conftest import KOLKATA, LONDON


def sat(db, norad_id):
    return satellite_from_omm(db.get_gp(norad_id).omm)


def test_pass_events_are_ordered_and_bounded(db, t0):
    passes = find_passes(sat(db, 25544), Observer(*KOLKATA), t0, t0 + timedelta(hours=24), 10.0,
                         track_points=31)
    assert passes, "ISS should clear 10 degrees over Kolkata within a day"
    for p in passes:
        assert t0 <= p.start.time <= p.culmination.time <= p.end.time <= t0 + timedelta(hours=24)
        assert p.culmination.elevation_deg >= 10.0
        assert p.culmination.elevation_deg >= max(p.start.elevation_deg, p.end.elevation_deg)
        if not p.partial:
            assert p.start.elevation_deg == pytest.approx(10.0, abs=0.05)
            assert p.end.elevation_deg == pytest.approx(10.0, abs=0.05)
            assert 30 < p.duration_s < 900  # an ISS pass above 10 degrees lasts minutes
        assert len(p.track) == 31
        assert max(pt.elevation_deg for pt in p.track) <= p.culmination.elevation_deg + 0.05
        assert 300 < p.range_km < 2500


def test_higher_threshold_gives_a_subset_of_shorter_passes(db, t0):
    args = (sat(db, 29), Observer(*KOLKATA), t0, t0 + timedelta(hours=24))
    low, high = find_passes(*args, 10.0), find_passes(*args, 40.0)
    assert len(high) <= len(low)
    for h in high:
        match = [p for p in low if p.start.time <= h.culmination.time <= p.end.time]
        assert len(match) == 1 and match[0].duration_s > h.duration_s


def test_latitude_beyond_inclination_has_no_pass(db, t0):
    # Vanguard 1 (i = 34 deg, perigee ~650 km) cannot reach 10 degrees elevation from London.
    assert find_passes(sat(db, 5), Observer(*LONDON), t0, t0 + timedelta(hours=24), 10.0) == []


def test_near_geosynchronous_object_is_reported_as_one_window_long_partial_pass(db, t0):
    passes = find_passes(sat(db, 634), Observer(*KOLKATA), t0, t0 + timedelta(hours=6), 5.0)
    if passes:  # only where Syncom 2 is currently above this longitude
        assert len(passes) == 1 and passes[0].partial


def test_window_edge_passes_are_flagged_partial(db, t0):
    full = find_passes(sat(db, 25544), Observer(*KOLKATA), t0, t0 + timedelta(hours=24), 10.0)
    mid = full[0].culmination.time
    cut = find_passes(sat(db, 25544), Observer(*KOLKATA), mid, mid + timedelta(hours=1), 10.0)
    assert cut[0].starts_before_window and cut[0].start.time == mid
    assert cut[0].end.time == full[0].end.time or abs(
        (cut[0].end.time - full[0].end.time).total_seconds()) < 1


def test_propagation_far_beyond_validity_is_an_error_for_decaying_elements(db):
    omm = dict(db.get_gp(25544).omm)
    omm["BSTAR"] = 0.05  # absurd drag: SGP4 reports decay within days
    epoch = datetime.fromisoformat(omm["EPOCH"]).replace(tzinfo=UTC)
    with pytest.raises(PropagationError):
        find_passes(satellite_from_omm(omm), Observer(*KOLKATA), epoch + timedelta(days=200),
                    epoch + timedelta(days=201), 10.0)


def test_malformed_elements_raise():
    with pytest.raises(PropagationError):
        satellite_from_omm({"NORAD_CAT_ID": 5})


def test_tle_export_round_trips_catalogue_number(db):
    l1, l2 = tle_lines(sat(db, 5))
    assert l1.startswith("1 00005U") and l2.startswith("2 00005") and len(l1) == len(l2) == 69


def test_subpoint_stays_within_inclination_band(db, t0):
    s = sat(db, 25544)
    for minute in range(0, 180, 7):
        lat, lon, height = subpoint(s, t0 + timedelta(minutes=minute))
        assert abs(lat) <= 51.8 and -180 <= lon <= 180 and 380 < height < 460


@pytest.mark.parametrize("az,name", [(0, "N"), (359, "N"), (45, "NE"), (90, "E"), (180, "S"),
                                     (202.5, "SSW"), (270, "W"), (348.74, "NNW"), (348.76, "N")])
def test_compass(az, name):
    assert compass(az) == name


def test_sun_altitude_matches_known_geometry():
    # March equinox 2026 (20 March, 14:46 UTC): the Sun is on the equator. At local apparent
    # noon on the equator it is within a fraction of a degree of the zenith.
    t = TS.utc(2026, 3, 20, 12, 7, 30)  # equation of time is about -7.5 min on this date
    assert float(sun_altitude_deg(wgs84.latlon(0.0, 0.0), t)) > 89.0
    # Opposite side of Earth: deep night.
    assert float(sun_altitude_deg(wgs84.latlon(0.0, 180.0), t)) < -89.0
    # June solstice noon at 23.44 N.
    t = TS.utc(2026, 6, 21, 12, 2, 0)
    assert float(sun_altitude_deg(wgs84.latlon(23.44, 0.0), t)) > 89.0
    # Polar night at 80 N in December.
    t = TS.utc(2026, 12, 21, 12, 0, 0)
    assert float(sun_altitude_deg(wgs84.latlon(80.0, 0.0), t)) < -12.0


@pytest.mark.parametrize("alt,lit,expected", [
    (20, True, "daylight"), (20, False, "daylight"), (-3, True, "twilight_sunlit"),
    (-3, False, "eclipsed"), (-20, True, "dark_sky_sunlit"), (-20, False, "eclipsed"),
])
def test_illumination_classes(alt, lit, expected):
    assert classify_illumination(alt, lit) == expected
