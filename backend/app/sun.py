"""Low-precision solar geometry for *illumination context* only.

Uses the Astronomical Almanac low-precision formulae (about 0.01 degree accuracy 1950-2050).
That is ample for telling night from twilight and sunlight from Earth's shadow; it is not used
for any pass timing. No external ephemeris download is required.
"""
from __future__ import annotations

import numpy as np
from skyfield.timelib import Time

EARTH_RADIUS_KM = 6378.137


def sun_unit_vector_gcrs(t: Time) -> np.ndarray:
    """Unit vector Earth -> Sun in the GCRS frame. Shape (3,) or (3, N)."""
    n = t.tt - 2451545.0
    mean_lon = np.radians((280.460 + 0.9856474 * n) % 360.0)
    g = np.radians((357.528 + 0.9856003 * n) % 360.0)
    ecl_lon = mean_lon + np.radians(1.915) * np.sin(g) + np.radians(0.020) * np.sin(2 * g)
    obliquity = np.radians(23.439 - 0.0000004 * n)
    of_date = np.array([
        np.cos(ecl_lon),
        np.cos(obliquity) * np.sin(ecl_lon),
        np.sin(obliquity) * np.sin(ecl_lon),
    ])
    # The formula is referred to the equator and equinox of date; rotate back to GCRS.
    return np.einsum("ij...,j...->i...", t.MT, of_date)


def sun_altitude_deg(observer, t: Time) -> np.ndarray:
    """Geometric altitude of the Sun's centre at a Skyfield GeographicPosition."""
    sun = sun_unit_vector_gcrs(t)
    local = np.einsum("ij...,j...->i...", observer.rotation_at(t), sun)
    return np.degrees(np.arcsin(np.clip(local[2], -1.0, 1.0)))


def is_sunlit(sat_position_km: np.ndarray, t: Time) -> np.ndarray:
    """True where a satellite (GCRS km) is outside Earth's cylindrical shadow."""
    sun = sun_unit_vector_gcrs(t)
    along = np.sum(sat_position_km * sun, axis=0)
    perp = np.linalg.norm(sat_position_km - along * sun, axis=0)
    return (along > 0) | (perp > EARTH_RADIUS_KM)


def classify_illumination(sun_alt_deg: float, sunlit: bool) -> str:
    if sun_alt_deg > -6.0:
        return "daylight" if sun_alt_deg > 0 else "twilight_sunlit" if sunlit else "eclipsed"
    return "dark_sky_sunlit" if sunlit else "eclipsed"
