import { describe, expect, it } from "vitest";

import reference from "./__fixtures__/skyfield-subpoints.json";
import {
  circularPeriodMinutes,
  circularSpeedKmS,
  eciPosition,
  footprintRadiusKm,
  orbitRing,
  periodMinutes,
  satrecFromTle,
  subPoint,
  sunDirectionEci,
} from "./orbit";

/**
 * Cross-implementation check: satellite.js (browser visualisation) against Skyfield (backend
 * predictions) for the same element sets and instants. The fixture is written by the backend.
 */
describe("satellite.js agrees with the Skyfield reference", () => {
  it.each(reference.cases)("NORAD $norad_id at $time", (c) => {
    const p = subPoint(satrecFromTle(c.tle1, c.tle2), new Date(c.time));
    expect(p).not.toBeNull();
    const dLon = ((p!.longitudeDeg - c.longitude_deg + 540) % 360) - 180;
    // 0.05 degrees is about 5 km on the ground: far below what the globe can show.
    expect(Math.abs(p!.latitudeDeg - c.latitude_deg)).toBeLessThan(0.05);
    expect(Math.abs(dLon) * Math.cos((c.latitude_deg * Math.PI) / 180)).toBeLessThan(0.05);
    expect(Math.abs(p!.heightKm - c.height_km)).toBeLessThan(1.5);
  });
});

describe("orbit helpers", () => {
  const iss = reference.cases.find((c) => c.norad_id === 25544)!;
  const rec = satrecFromTle(iss.tle1, iss.tle2);

  it("derives the period from mean motion", () => {
    expect(periodMinutes(rec)).toBeGreaterThan(90);
    expect(periodMinutes(rec)).toBeLessThan(94);
  });

  it("samples a closed ring of one revolution", () => {
    const ring = orbitRing(rec, new Date(iss.time), 90);
    expect(ring).toHaveLength(91);
    const [first, last] = [ring[0]!, ring[90]!];
    const gap = Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2]);
    expect(gap).toBeLessThan(80); // km; the ring closes to within a fraction of a degree
    for (const p of ring) {
      const r = Math.hypot(...p);
      expect(r).toBeGreaterThan(6378 + 350);
      expect(r).toBeLessThan(6378 + 480);
    }
  });

  it("returns null rather than a made-up position when SGP4 fails", () => {
    const decayed = satrecFromTle(iss.tle1, iss.tle2);
    decayed.bstar = 0.5; // absurd drag: SGP4 reports decay
    expect(eciPosition(decayed, new Date(new Date(iss.time).getTime() + 400 * 86_400_000))).toBeNull();
  });

  it("puts the Sun where the calendar says it is", () => {
    const equinox = sunDirectionEci(new Date("2026-03-20T14:46:00Z"));
    expect(Math.abs(equinox[2])).toBeLessThan(0.005); // on the equator
    expect(equinox[0]).toBeGreaterThan(0.999); // toward the vernal equinox direction
    const solstice = sunDirectionEci(new Date("2026-06-21T08:25:00Z"));
    expect((Math.asin(solstice[2]) * 180) / Math.PI).toBeCloseTo(23.44, 1);
    expect(Math.hypot(...solstice)).toBeCloseTo(1, 6);
  });
});

describe("Kepler helpers for the orbit lab", () => {
  it("reproduces textbook circular orbits", () => {
    expect(circularPeriodMinutes(420)).toBeCloseTo(92.8, 0); // ISS-like
    expect(circularPeriodMinutes(35786)).toBeCloseTo(1436.1, 0); // geostationary: one sidereal day
    expect(circularSpeedKmS(420)).toBeCloseTo(7.66, 1);
    expect(circularSpeedKmS(35786)).toBeCloseTo(3.07, 1);
  });

  it("computes the elevation footprint", () => {
    // At the horizon (0 degrees) the footprint is the geometric horizon distance along the ground.
    expect(footprintRadiusKm(420, 0)).toBeCloseTo(6378.137 * Math.acos(6378.137 / 6798.137), 3);
    expect(footprintRadiusKm(420, 10)).toBeLessThan(footprintRadiusKm(420, 0));
    expect(footprintRadiusKm(420, 90)).toBeCloseTo(0, 6);
    expect(footprintRadiusKm(2000, 10)).toBeGreaterThan(footprintRadiusKm(420, 10));
  });
});
