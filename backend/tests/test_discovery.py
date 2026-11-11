from __future__ import annotations

from datetime import timedelta

import pytest

from app import config
from app.db import Database, GpRow
from app.discovery import discover, evaluate, freshness, pretty_name, summarize
from app.models import DiscoverRequest, ObserverModel
from app.passes import Observer

from .conftest import KOLKATA, TROMSO


def run(db, t0, latlon, **kw):
    req = DiscoverRequest(observer=ObserverModel(latitude_deg=latlon[0], longitude_deg=latlon[1]),
                          **kw)
    return discover(db, req, t0, "snapshot", t0)


@pytest.fixture(scope="module")
def kolkata(db, t0):
    return run(db, t0, KOLKATA)


def test_candidates_are_ranked_by_launch_date_then_catalogue_number(kolkata):
    keys = [(c.satellite.launch_date, c.satellite.norad_id) for c in kolkata.candidates]
    assert keys == sorted(keys)
    assert [c.rank for c in kolkata.candidates] == list(range(1, len(keys) + 1))
    assert kolkata.oldest == kolkata.candidates[0]


def test_every_candidate_has_a_qualifying_pass_inside_the_window(kolkata):
    for c in kolkata.candidates:
        assert c.pass_count == len(c.passes) >= 1
        assert c.highest_elevation_deg >= kolkata.min_elevation_deg
        for p in c.passes:
            assert kolkata.window_start <= p.start.time and p.end.time <= kolkata.window_end
            assert p.culmination.elevation_deg >= kolkata.min_elevation_deg


def test_every_set_member_is_either_eligible_or_excluded_with_a_reason(db, kolkata):
    members = {m[0] for m in db.candidate_set()}
    eligible = {c.satellite.norad_id for c in kolkata.candidates}
    excluded = {e.norad_id for e in kolkata.excluded}
    assert eligible | excluded == members and not (eligible & excluded)
    assert sum(kolkata.exclusion_counts.values()) == len(excluded)
    assert kolkata.methodology.candidate_count == len(members)


def test_objects_without_public_elements_are_excluded_not_guessed(db, kolkata):
    missing = set(db.gp_missing())
    assert missing, "the capture includes objects CelesTrak has no GP data for"
    reasons = {e.norad_id: e.reason for e in kolkata.excluded}
    assert all(reasons[n] == "no_elements" for n in missing)


def test_oldest_at_kolkata_is_vanguard_1_but_not_at_high_latitude(db, t0, kolkata):
    assert kolkata.oldest.satellite.norad_id == 5
    tromso = run(db, t0, TROMSO)
    reasons = {e.norad_id: e.reason for e in tromso.excluded}
    assert reasons[5] == "no_pass"  # 34-degree inclination never reaches 69.6 N
    assert tromso.oldest.satellite.launch_date > "1958-03-17"
    assert tromso.oldest.satellite.inclination_deg > 55


def test_raising_the_threshold_never_adds_candidates(db, t0, kolkata):
    strict = run(db, t0, KOLKATA, min_elevation_deg=60)
    assert {c.satellite.norad_id for c in strict.candidates} <= {
        c.satellite.norad_id for c in kolkata.candidates}
    assert len(strict.candidates) < len(kolkata.candidates)


def test_elements_beyond_the_age_limit_are_not_propagated(db, t0):
    late = t0 + timedelta(days=config.MAX_ELEMENT_AGE_DAYS + 5)
    result = run(db, late, KOLKATA)
    assert result.candidates == [] and result.oldest is None
    assert set(result.exclusion_counts) == {"stale_elements", "no_elements"}


def test_provenance_reports_epoch_age_and_source(kolkata, t0):
    for c in kolkata.candidates:
        p = c.provenance
        assert p.source == "snapshot" and "celestrak.org" in p.source_url
        assert p.element_age_days == pytest.approx(
            (t0 - p.element_epoch).total_seconds() / 86400, abs=1e-3)
        assert p.freshness == freshness(p.element_age_days)


def test_evaluate_reports_first_failing_rule(db, t0):
    obs = Observer(*KOLKATA)
    end = t0 + timedelta(hours=24)
    assert evaluate(None, "No GP data found", obs, t0, end, 10).reason == "no_elements"
    gp = db.get_gp(25544)
    broken = GpRow(gp.norad_id, gp.epoch, {"NORAD_CAT_ID": 25544}, gp.source, gp.source_url,
                   gp.retrieved_at)
    assert evaluate(broken, None, obs, t0, end, 10).reason == "propagation_error"
    assert evaluate(gp, None, obs, t0, end, 89).reason == "no_pass"
    assert evaluate(gp, None, obs, t0, end, 10).reason is None


def test_launch_dates_agree_between_satcat_and_curated_records(db):
    summaries = [summarize(r, {}) for r in db.all_satcat()]
    assert [s.name for s in summaries if s.launch_date_verification == "mismatch"] == []
    curated = [s for s in summaries if s.has_story]
    assert len(curated) >= 25  # the brief's year-one target
    assert all(s.launch_date_verification == "satcat+curated" for s in curated)


def test_curated_fate_agrees_with_catalogue_orbit_status(db):
    for s in (summarize(r, {}) for r in db.all_satcat()):
        if s.has_story:
            assert (s.fate == "reentered") == (not s.on_orbit), s.name


def test_results_are_deterministic(db, t0, kolkata):
    again = run(db, t0, KOLKATA)
    assert again.model_dump() == kolkata.model_dump()


def test_empty_database_yields_no_fabricated_result(t0):
    result = run(Database(":memory:"), t0, KOLKATA)
    assert result.oldest is None and result.candidates == [] and result.excluded == []


@pytest.mark.parametrize("raw,expected", [
    ("EXPLORER 16", "Explorer 16"), ("TRANSIT 5B-1", "Transit 5B-1"), ("OPS 3367 A", "OPS 3367 A"),
    ("TIROS 3", "TIROS 3"), ("VELA 2", "Vela 2"),
])
def test_pretty_name(raw, expected):
    assert pretty_name(raw) == expected
