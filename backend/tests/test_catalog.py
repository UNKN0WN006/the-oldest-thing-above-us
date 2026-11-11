# ruff: noqa: E501
from __future__ import annotations

from dataclasses import replace

from app.catalog import is_candidate_eligible, rows_to_keep, select_candidates
from app.celestrak import parse_satcat_csv
from app.db import SatcatRow

CSV = """OBJECT_NAME,OBJECT_ID,NORAD_CAT_ID,OBJECT_TYPE,OPS_STATUS_CODE,OWNER,LAUNCH_DATE,LAUNCH_SITE,DECAY_DATE,PERIOD,INCLINATION,APOGEE,PERIGEE,RCS,DATA_STATUS_CODE,ORBIT_CENTER,ORBIT_TYPE
SL-1 R/B,1957-001A,1,R/B,D,CIS,1957-10-04,TYMSC,1957-12-01,96.19,65.10,938,214,20.4200,,EA,IMP
VANGUARD 1,1958-002B,5,PAY,,US,1958-03-17,AFETR,,132.58,34.24,3819,651,0.122,,EA,ORB
VANGUARD R/B,1958-002A,16,R/B,,US,1958-03-17,AFETR,,137.2,34.27,4222,654,0.5,,EA,ORB
EXPLORER 7,1959-009A,22,PAY,,US,1959-10-13,AFETR,,94.00,50.24,520,421,0.5,,EA,ORB
LUNA 10,1966-027A,2126,PAY,,CIS,1966-03-31,TYMSC,,,,,,,,MO,ORB
HST,1990-037B,20580,PAY,+,US,1990-04-24,AFETR,,94.8,28.47,530,525,28,,EA,ORB
"""


def rows() -> list[SatcatRow]:
    return parse_satcat_csv(CSV, "2026-01-01T00:00:00Z")


def test_parse_satcat_types_and_blanks():
    by_id = {r.norad_id: r for r in rows()}
    assert by_id[5].launch_date == "1958-03-17"
    assert by_id[5].decay_date is None and by_id[5].on_orbit
    assert by_id[1].decay_date == "1957-12-01" and not by_id[1].on_orbit
    assert by_id[2126].period_min is None
    assert by_id[5].perigee_km == 651


def test_only_on_orbit_earth_payloads_are_candidates():
    eligible = {r.norad_id for r in rows() if is_candidate_eligible(r)}
    assert eligible == {5, 22, 20580}  # no rocket body, no decayed object, no lunar orbiter


def test_selection_takes_oldest_n_then_curated_extras():
    picked = select_candidates(rows(), curated_ids={20580}, count=2)
    assert picked == [(5, "oldest_payload", 1), (22, "oldest_payload", 2), (20580, "curated", 3)]
    assert select_candidates(rows(), curated_ids=set(), count=2)[-1][0] == 22


def test_selection_orders_same_day_launches_by_catalogue_number():
    twin = replace(rows()[1], norad_id=4, name="TWIN")
    picked = select_candidates(rows() + [twin], set(), count=2)
    assert [p[0] for p in picked] == [4, 5]


def test_rows_to_keep_includes_decayed_curated_records():
    all_rows = rows()
    kept = rows_to_keep(all_rows, select_candidates(all_rows, set(), count=1), {1})
    assert {r.norad_id for r in kept} == {1, 5}


def test_bundled_snapshot_matches_declared_set(db):
    from app import config
    members = db.candidate_set()
    assert sum(1 for m in members if m[1] == "oldest_payload") == config.OLDEST_PAYLOAD_COUNT
    launch = [db.get_satcat(m[0]).launch_date for m in members]
    assert launch == sorted(launch)
    assert members[0][0] == 5  # Vanguard 1 is the oldest payload still in orbit
