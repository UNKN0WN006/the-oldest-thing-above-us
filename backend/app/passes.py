"""Observer-relative pass prediction with Skyfield on SGP4/SDP4.

A *pass* here is an interval during which the satellite's geometric elevation, seen from the
observer, is at or above a threshold. It is a statement about geometry, not about visibility.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

import numpy as np
from sgp4 import exporter
from skyfield.api import EarthSatellite, load, wgs84
from skyfield.timelib import Time

from .sun import classify_illumination, is_sunlit, sun_altitude_deg

# Built-in timescale tables: no network download, deterministic.
TS = load.timescale(builtin=True)

COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
           "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]


class PropagationError(RuntimeError):
    pass


@dataclass(frozen=True)
class Observer:
    latitude_deg: float
    longitude_deg: float
    elevation_m: float = 0.0

    def position(self):
        return wgs84.latlon(self.latitude_deg, self.longitude_deg, self.elevation_m)


@dataclass
class PassPoint:
    time: datetime
    azimuth_deg: float
    elevation_deg: float


@dataclass
class Pass:
    start: PassPoint            # rise through the threshold, or window start if partial
    culmination: PassPoint      # highest point inside the window
    end: PassPoint              # set through the threshold, or window end if partial
    starts_before_window: bool
    ends_after_window: bool
    range_km: float             # observer -> satellite distance at culmination
    sun_altitude_deg: float     # at the observer, at culmination
    satellite_sunlit: bool      # at culmination
    illumination: str
    track: list[PassPoint] = field(default_factory=list)

    @property
    def duration_s(self) -> float:
        return (self.end.time - self.start.time).total_seconds()

    @property
    def partial(self) -> bool:
        return self.starts_before_window or self.ends_after_window


def compass(azimuth_deg: float) -> str:
    return COMPASS[int((azimuth_deg % 360) / 22.5 + 0.5) % 16]


def satellite_from_omm(omm: dict[str, Any]) -> EarthSatellite:
    try:
        return EarthSatellite.from_omm(TS, {k: v for k, v in omm.items() if v is not None})
    except Exception as exc:  # noqa: BLE001 - any malformed record is a data problem
        raise PropagationError(f"cannot initialise SGP4 from elements: {exc}") from exc


def tle_lines(sat: EarthSatellite) -> tuple[str, str] | None:
    try:
        return exporter.export_tle(sat.model)
    except Exception:  # noqa: BLE001 - e.g. catalogue numbers that do not fit the TLE format
        return None


def _point(sat: EarthSatellite, observer, t: Time) -> tuple[PassPoint, float, np.ndarray]:
    topo = (sat - observer).at(t)
    alt, az, dist = topo.altaz()
    if not np.isfinite(alt.degrees):
        raise PropagationError("SGP4 returned a non-finite position")
    return (PassPoint(t.utc_datetime(), float(az.degrees), float(alt.degrees)),
            float(dist.km), sat.at(t).position.km)


def _check_sgp4(sat: EarthSatellite, t0: Time, t1: Time) -> None:
    """Fail loudly if SGP4 reports an error anywhere in the window (decay, bad elements)."""
    times = TS.linspace(t0, t1, 49)
    geocentric = sat.at(times)
    message = getattr(geocentric, "message", None)
    if message is None:
        return
    messages = [message] if isinstance(message, str) or message is None else list(message)
    bad = next((m for m in messages if m), None)
    if bad:
        raise PropagationError(f"SGP4: {bad}")


def find_passes(sat: EarthSatellite, observer: Observer, start: datetime, end: datetime,
                min_elevation_deg: float, track_points: int = 0) -> list[Pass]:
    """All passes in [start, end] whose culmination reaches ``min_elevation_deg``."""
    site = observer.position()
    t0, t1 = TS.from_datetime(start), TS.from_datetime(end)
    _check_sgp4(sat, t0, t1)

    times, events = sat.find_events(site, t0, t1, altitude_degrees=min_elevation_deg)
    difference = sat - site

    def elevation(t: Time) -> float:
        return float(difference.at(t).altaz()[0].degrees)

    passes: list[Pass] = []
    rise: Time | None = None
    peak: Time | None = None
    open_at_start = elevation(t0) >= min_elevation_deg
    if open_at_start:
        rise = t0

    def close(set_time: Time, ends_after: bool) -> None:
        nonlocal rise, peak
        assert rise is not None
        starts_before = rise is t0 and open_at_start
        if peak is None:
            # No interior culmination: the highest point is at a window edge.
            peak = rise if elevation(rise) >= elevation(set_time) else set_time
        passes.append(_build_pass(sat, site, rise, peak, set_time, starts_before, ends_after,
                                  track_points))
        rise, peak = None, None

    for t, event in zip(times, events, strict=True):
        if event == 0:
            rise, peak = t, None
        elif event == 1:
            if rise is not None and (peak is None or elevation(t) > elevation(peak)):
                peak = t
        elif event == 2 and rise is not None:
            close(t, ends_after=False)
    if rise is not None:
        close(t1, ends_after=True)
    return [p for p in passes if p.culmination.elevation_deg >= min_elevation_deg - 1e-6]


def _build_pass(sat: EarthSatellite, site, rise: Time, peak: Time, set_: Time,
                starts_before: bool, ends_after: bool, track_points: int) -> Pass:
    p_rise, _, _ = _point(sat, site, rise)
    p_peak, range_km, sat_pos = _point(sat, site, peak)
    p_set, _, _ = _point(sat, site, set_)
    sun_alt = float(sun_altitude_deg(site, peak))
    sunlit = bool(is_sunlit(sat_pos, peak))
    track: list[PassPoint] = []
    if track_points > 1:
        ts = TS.linspace(rise, set_, track_points)
        alt, az, _ = (sat - site).at(ts).altaz()
        base = rise.utc_datetime()
        span = (set_.utc_datetime() - base).total_seconds()
        track = [PassPoint(base + timedelta(seconds=span * i / (track_points - 1)),
                           float(az.degrees[i]), float(alt.degrees[i]))
                 for i in range(track_points)]
    return Pass(p_rise, p_peak, p_set, starts_before, ends_after, range_km, sun_alt, sunlit,
                classify_illumination(sun_alt, sunlit), track)


def subpoint(sat: EarthSatellite, when: datetime) -> tuple[float, float, float]:
    """Geodetic latitude, longitude (deg) and height (km) below the satellite."""
    geocentric = sat.at(TS.from_datetime(when))
    pos = wgs84.geographic_position_of(geocentric)
    return float(pos.latitude.degrees), float(pos.longitude.degrees), float(pos.elevation.km)
