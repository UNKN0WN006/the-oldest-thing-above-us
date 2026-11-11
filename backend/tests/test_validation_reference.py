"""Validation against independent references (see docs/VALIDATION.md).

1. PyEphem (libastro): a separate SGP4/SDP4 implementation and a separate topocentric
   transformation. We evaluate it at the event times Skyfield reports.
2. Vallado et al. (2006) SGP4 verification vectors, shipped with the ``sgp4`` package:
   confirms the installed propagator reproduces the published reference output.
"""
from __future__ import annotations

import math
import re
from datetime import timedelta
from pathlib import Path

import ephem
import pytest
import sgp4
from sgp4.api import Satrec

from app.passes import Observer, find_passes, satellite_from_omm, tle_lines

from .conftest import KOLKATA, LONDON, SYDNEY

# Tolerances: what "agreement" means for a classroom-grade prediction.
ELEVATION_TOL_DEG = 0.05
CULMINATION_TOL_S = 2.0
RANGE_TOL_KM = 2.0
AZIMUTH_TOL_DEG = 0.1  # great-circle (scaled by cos elevation)

SAMPLE = [5, 22, 29, 340, 503, 8820, 13777, 20580, 25544, 27386]
SITES = [KOLKATA, LONDON, SYDNEY]


def reference_altaz(body, lat, lon, when):
    obs = ephem.Observer()
    obs.lat, obs.lon, obs.elevation, obs.pressure = str(lat), str(lon), 0, 0  # no refraction
    obs.date = ephem.Date(when.replace(tzinfo=None))
    body.compute(obs)
    return math.degrees(body.alt), math.degrees(body.az), body.range / 1000.0


@pytest.mark.parametrize("norad_id", SAMPLE)
def test_passes_agree_with_pyephem(db, t0, norad_id):
    sat = satellite_from_omm(db.get_gp(norad_id).omm)
    body = ephem.readtle(str(norad_id), *tle_lines(sat))
    checked = 0
    for lat, lon in SITES:
        for p in find_passes(sat, Observer(lat, lon), t0, t0 + timedelta(hours=24), 10.0):
            if p.partial:
                continue
            alt, az, rng = reference_altaz(body, lat, lon, p.culmination.time)
            assert alt == pytest.approx(p.culmination.elevation_deg, abs=ELEVATION_TOL_DEG)
            assert rng == pytest.approx(p.range_km, abs=RANGE_TOL_KM)
            d_az = abs((az - p.culmination.azimuth_deg + 180) % 360 - 180)
            assert d_az * math.cos(math.radians(alt)) < AZIMUTH_TOL_DEG
            # Threshold crossings: the reference must also see 10 degrees at our rise and set.
            assert reference_altaz(body, lat, lon, p.start.time)[0] == pytest.approx(
                10.0, abs=ELEVATION_TOL_DEG)
            assert reference_altaz(body, lat, lon, p.end.time)[0] == pytest.approx(
                10.0, abs=ELEVATION_TOL_DEG)
            # Culmination time: the reference's own maximum is within the tolerance.
            offsets = [k * 0.5 for k in range(-60, 61)]
            best = max(offsets, key=lambda k: reference_altaz(
                body, lat, lon, p.culmination.time + timedelta(seconds=k))[0])
            assert abs(best) <= CULMINATION_TOL_S
            checked += 1
    assert checked >= 3, "sample should produce several complete passes across the three sites"


def test_reference_agrees_that_vanguard_1_never_clears_london(db, t0):
    sat = satellite_from_omm(db.get_gp(5).omm)
    body = ephem.readtle("5", *tle_lines(sat))
    highest = max(reference_altaz(body, *LONDON, t0 + timedelta(seconds=30 * i))[0]
                  for i in range(2880))
    assert highest < 10.0
    assert find_passes(sat, Observer(*LONDON), t0, t0 + timedelta(hours=24), 10.0) == []


def _vallado_cases():
    root = Path(sgp4.__file__).parent
    tle_text = (root / "SGP4-VER.TLE").read_text().splitlines()
    lines = [ln for ln in tle_text if ln.startswith(("1 ", "2 "))]
    tles = {int(lines[i][2:7]): (lines[i][:69], lines[i + 1][:69])
            for i in range(0, len(lines), 2)}
    expected: dict[int, list[tuple[float, list[float]]]] = {}
    current = None
    for ln in (root / "tcppver.out").read_text().splitlines():
        m = re.match(r"^(\d+) xx$", ln.strip())
        if m:
            current = int(m.group(1))
            expected[current] = []
        elif current is not None and ln.strip():
            f = ln.split()
            expected[current].append((float(f[0]), [float(x) for x in f[1:7]]))
    return tles, expected


def test_sgp4_reproduces_vallado_verification_vectors():
    tles, expected = _vallado_cases()
    compared = 0
    worst = 0.0
    for satnum, rows in expected.items():
        if satnum not in tles:
            continue
        sat = Satrec.twoline2rv(*tles[satnum])
        for minutes, state in rows:
            err, r, _ = sat.sgp4(sat.jdsatepoch, sat.jdsatepochF + minutes / 1440.0)
            if err != 0:
                break  # the reference file also stops at the first propagation error
            worst = max(worst, max(abs(a - b) for a, b in zip(r, state[:3], strict=True)))
            compared += 1
    assert compared > 400
    assert worst < 1e-3, f"position differs from the published vectors by {worst} km"
