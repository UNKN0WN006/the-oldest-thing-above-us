/**
 * In-browser orbital geometry for the *visualisation* (globe, orbit lab).
 *
 * Predictions shown as numbers come from the Skyfield backend. These helpers use satellite.js,
 * an independent SGP4 implementation, and are cross-checked against Skyfield in orbit.test.ts.
 */
import * as satellite from "satellite.js";

export const EARTH_RADIUS_KM = 6378.137;
export const MU_EARTH = 398600.4418; // km^3 / s^2

export type Vec3 = [number, number, number];

export interface SubPoint {
  latitudeDeg: number;
  longitudeDeg: number;
  heightKm: number;
}

export function satrecFromTle(line1: string, line2: string): satellite.SatRec {
  return satellite.twoline2satrec(line1, line2);
}

/** Earth-centred inertial (TEME) position in km, or null if SGP4 reports an error. */
export function eciPosition(rec: satellite.SatRec, when: Date): Vec3 | null {
  const result = satellite.propagate(rec, when);
  const p = result.position;
  if (!p || typeof p === "boolean" || !Number.isFinite(p.x)) return null;
  return [p.x, p.y, p.z];
}

export function gmst(when: Date): number {
  return satellite.gstime(when);
}

export function subPoint(rec: satellite.SatRec, when: Date): SubPoint | null {
  const eci = eciPosition(rec, when);
  if (!eci) return null;
  const geo = satellite.eciToGeodetic({ x: eci[0], y: eci[1], z: eci[2] }, gmst(when));
  let lon = satellite.degreesLong(geo.longitude);
  if (lon > 180) lon -= 360;
  return { latitudeDeg: satellite.degreesLat(geo.latitude), longitudeDeg: lon, heightKm: geo.height };
}

/** Orbital period in minutes from the element set's mean motion. */
export function periodMinutes(rec: satellite.SatRec): number {
  return (2 * Math.PI) / rec.no; // rec.no is in radians per minute
}

/** One revolution sampled in the inertial frame, starting at `when`. */
export function orbitRing(rec: satellite.SatRec, when: Date, samples = 180): Vec3[] {
  const period = periodMinutes(rec) * 60_000;
  const out: Vec3[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const p = eciPosition(rec, new Date(when.getTime() + (period * i) / samples));
    if (p) out.push(p);
  }
  return out;
}

/** Unit vector Earth → Sun in the inertial frame (low-precision almanac formula, ~0.01°). */
export function sunDirectionEci(when: Date): Vec3 {
  const n = when.getTime() / 86_400_000 + 2440587.5 - 2451545.0;
  const rad = Math.PI / 180;
  const L = ((280.46 + 0.9856474 * n) % 360) * rad;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = L + 1.915 * rad * Math.sin(g) + 0.02 * rad * Math.sin(2 * g);
  const eps = (23.439 - 0.0000004 * n) * rad;
  return [Math.cos(lambda), Math.cos(eps) * Math.sin(lambda), Math.sin(eps) * Math.sin(lambda)];
}

// ---- Kepler helpers for the Educational Explorer -------------------------------------------

/** Period (minutes) of a circular orbit at the given altitude. */
export function circularPeriodMinutes(altitudeKm: number): number {
  const a = EARTH_RADIUS_KM + altitudeKm;
  return (2 * Math.PI * Math.sqrt(a ** 3 / MU_EARTH)) / 60;
}

/** Speed (km/s) of a circular orbit at the given altitude. */
export function circularSpeedKmS(altitudeKm: number): number {
  return Math.sqrt(MU_EARTH / (EARTH_RADIUS_KM + altitudeKm));
}

/**
 * Ground distance (km) from the sub-satellite point within which the satellite appears at or
 * above `minElevationDeg`. Spherical Earth.
 */
export function footprintRadiusKm(altitudeKm: number, minElevationDeg: number): number {
  const e = (minElevationDeg * Math.PI) / 180;
  const centralAngle = Math.acos((EARTH_RADIUS_KM * Math.cos(e)) / (EARTH_RADIUS_KM + altitudeKm)) - e;
  return Math.max(0, centralAngle) * EARTH_RADIUS_KM;
}
