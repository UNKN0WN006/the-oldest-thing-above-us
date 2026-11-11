"""Print the Skyfield-vs-PyEphem comparison table used in docs/VALIDATION.md.

    python -m scripts.validate_reference            # bundled capture
    python -m scripts.validate_reference --live     # fetch current elements from CelesTrak
    python -m scripts.validate_reference --db var/aboveus.sqlite3   # a running server's cache
"""
from __future__ import annotations

import math
import sys
from datetime import timedelta

import ephem

from app.catalog import seed_from_snapshot
from app.celestrak import CelesTrakClient
from app.db import Database, parse_iso, utcnow
from app.passes import Observer, find_passes, satellite_from_omm, tle_lines

SAMPLE = [5, 22, 29, 340, 503, 8820, 13777, 20580, 25544, 27386]
SITES = {"Kolkata": (22.5726, 88.3639), "London": (51.5074, -0.1278),
         "Sydney": (-33.8688, 151.2093)}


def reference(body, lat, lon, when):
    obs = ephem.Observer()
    obs.lat, obs.lon, obs.elevation, obs.pressure = str(lat), str(lon), 0, 0
    obs.date = ephem.Date(when.replace(tzinfo=None))
    body.compute(obs)
    return math.degrees(body.alt), body.range / 1000.0


def main() -> int:  # noqa: C901
    live = "--live" in sys.argv
    if "--db" in sys.argv:
        db = Database(sys.argv[sys.argv.index("--db") + 1])
        rows = {n: db.get_gp(n) for n in SAMPLE}
        omms = {n: r.omm if r else None for n, r in rows.items()}
        start = utcnow().replace(microsecond=0)
        sources = sorted({r.source for r in rows.values() if r})
        fetched = max(r.retrieved_at for r in rows.values() if r)
        label = f"server cache ({'/'.join(sources)} elements, newest retrieval {fetched})"
    elif live:
        client = CelesTrakClient()
        omms = {n: client.fetch_gp(n).omm for n in SAMPLE}
        client.close()
        start = utcnow().replace(microsecond=0)
        label = f"live CelesTrak elements fetched {start.isoformat()}"
    else:
        db = Database(":memory:")
        seed_from_snapshot(db)
        omms = {n: db.get_gp(n).omm for n in SAMPLE}
        start = parse_iso(db.get_meta("snapshot_captured_at"))
        label = f"bundled capture of {start.isoformat()}"
    print(f"Source: {label}; window 24 h; threshold 10 deg; sites: {', '.join(SITES)}\n")
    print("| NORAD | Object | Passes | max |d elevation| at peak (deg) | max |d elevation| at "
          "rise/set (deg) | max |d peak time| (s) | max |d range| (km) |")
    print("|---|---|---|---|---|---|---|")
    total = 0
    worst = [0.0, 0.0, 0.0, 0.0]
    for nid in SAMPLE:
        omm = omms[nid]
        if omm is None:
            continue
        sat = satellite_from_omm(omm)
        body = ephem.readtle(str(nid), *tle_lines(sat))
        w = [0.0, 0.0, 0.0, 0.0]
        n = 0
        for lat, lon in SITES.values():
            for p in find_passes(sat, Observer(lat, lon), start, start + timedelta(hours=24), 10.0):
                if p.partial:
                    continue
                alt, rng = reference(body, lat, lon, p.culmination.time)
                edge = max(abs(reference(body, lat, lon, p.start.time)[0] - 10),
                           abs(reference(body, lat, lon, p.end.time)[0] - 10))
                best = max((k * 0.25 for k in range(-80, 81)), key=lambda k: reference(
                    body, lat, lon, p.culmination.time + timedelta(seconds=k))[0])
                vals = [abs(alt - p.culmination.elevation_deg), edge, abs(best),
                        abs(rng - p.range_km)]
                w = [max(a, b) for a, b in zip(w, vals, strict=True)]
                n += 1
        total += n
        worst = [max(a, b) for a, b in zip(worst, w, strict=True)]
        print(f"| {nid} | {omm['OBJECT_NAME']} | {n} | {w[0]:.3f} | {w[1]:.3f} | {w[2]:.2f} | "
              f"{w[3]:.2f} |")
    print(f"| | **All** | **{total}** | **{worst[0]:.3f}** | **{worst[1]:.3f}** | "
          f"**{worst[2]:.2f}** | **{worst[3]:.2f}** |")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
