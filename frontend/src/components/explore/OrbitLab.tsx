"use client";

import { useState } from "react";

import { circularPeriodMinutes, circularSpeedKmS, EARTH_RADIUS_KM, footprintRadiusKm } from "@/lib/orbit";

export interface Preset {
  name: string;
  altitudeKm: number;
}

const MIN_ALT = 200;
const MAX_ALT = 40000;
const toSlider = (alt: number) => (Math.log(alt / MIN_ALT) / Math.log(MAX_ALT / MIN_ALT)) * 1000;
const fromSlider = (v: number) => MIN_ALT * (MAX_ALT / MIN_ALT) ** (v / 1000);

function formatPeriod(minutes: number): string {
  if (minutes < 120) return `${minutes.toFixed(0)} min`;
  const h = Math.floor(minutes / 60);
  return `${h} h ${Math.round(minutes - h * 60)} min`;
}

export function OrbitLab({ presets }: { presets: Preset[] }) {
  const [altitude, setAltitude] = useState(650);
  const [minEl, setMinEl] = useState(10);

  const period = circularPeriodMinutes(altitude);
  const speed = circularSpeedKmS(altitude);
  const footprint = footprintRadiusKm(altitude, minEl);
  const share = (1 - Math.cos(footprint / EARTH_RADIUS_KM)) / 2;

  // Diagram: Earth cross-section with the satellite straight up and its footprint cone.
  const scale = 78 / EARTH_RADIUS_KM;
  const drawAlt = Math.min(altitude, 9000); // keep the satellite on the canvas; label says when clipped
  const satY = -(EARTH_RADIUS_KM + drawAlt) * scale;
  const half = footprint / EARTH_RADIUS_KM;
  const edge = (sign: number) => [sign * 78 * Math.sin(half), -78 * Math.cos(half)] as const;
  const [lx, ly] = edge(-1);
  const [rx, ry] = edge(1);

  return (
    <div className="lab">
      <div>
        <div className="field">
          <label htmlFor="alt">Altitude above the surface</label>
          <input
            id="alt"
            className="range"
            type="range"
            min={0}
            max={1000}
            step={1}
            value={toSlider(altitude)}
            onChange={(e) => setAltitude(Math.round(fromSlider(Number(e.target.value)) / 10) * 10)}
            aria-valuetext={`${altitude.toLocaleString("en-GB")} kilometres`}
          />
        </div>
        <div className="chips" role="group" aria-label="Jump to a real spacecraft's average altitude">
          {presets.map((p) => (
            <button key={p.name} type="button" aria-pressed={Math.abs(p.altitudeKm - altitude) < 6} onClick={() => setAltitude(Math.round(p.altitudeKm / 10) * 10)}>
              {p.name}
            </button>
          ))}
        </div>
        <div className="readouts" aria-live="polite">
          <div>
            <div className="readout__value">{altitude.toLocaleString("en-GB")} km</div>
            <div className="readout__label">Altitude</div>
          </div>
          <div>
            <div className="readout__value" data-testid="lab-period">
              {formatPeriod(period)}
            </div>
            <div className="readout__label">One orbit</div>
          </div>
          <div>
            <div className="readout__value">{speed.toFixed(2)} km/s</div>
            <div className="readout__label">Speed</div>
          </div>
        </div>
        <div className="field">
          <label htmlFor="el">How high must it appear? ({minEl}° above the horizon)</label>
          <input id="el" className="range" type="range" min={0} max={60} step={5} value={minEl} onChange={(e) => setMinEl(Number(e.target.value))} />
        </div>
        <p style={{ marginTop: "1rem" }}>
          From this altitude the spacecraft appears at least {minEl}° high to anyone within{" "}
          <strong data-testid="lab-footprint">{Math.round(footprint).toLocaleString("en-GB")} km</strong> of the point directly beneath it —
          about {(share * 100).toFixed(share < 0.01 ? 2 : 1)}% of Earth&apos;s surface at any moment.
        </p>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Circular orbit, spherical Earth: T = 2π√(a³/μ). Real orbits such as Vanguard 1&apos;s are ellipses, so their
          height and speed change around each lap.
        </p>
      </div>
      <svg viewBox="-150 -200 300 300" role="img" aria-label={`Cross-section of Earth with a satellite ${altitude} kilometres up and the region from which it is at least ${minEl} degrees above the horizon.`}>
        <defs>
          <radialGradient id="lab-earth" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#1f4687" />
            <stop offset="100%" stopColor="#081428" />
          </radialGradient>
        </defs>
        <circle r={(EARTH_RADIUS_KM + drawAlt) * scale} fill="none" stroke="rgba(108,182,255,0.35)" strokeDasharray="2 5" />
        <path d={`M0,${satY} L${lx},${ly} A78,78 0 0 1 ${rx},${ry} Z`} fill="rgba(108,182,255,0.14)" stroke="rgba(108,182,255,0.4)" />
        <circle r={78} fill="url(#lab-earth)" stroke="rgba(142,200,255,0.6)" />
        <path d={`M${lx},${ly} A78,78 0 0 1 ${rx},${ry}`} fill="none" stroke="#f0b862" strokeWidth={3} strokeLinecap="round" />
        <circle cx={0} cy={satY} r={4} fill="#fff" />
        <text x={8} y={satY + 3}>
          {altitude > 9000 ? "satellite (far above this frame)" : "satellite"}
        </text>
        <text x={0} y={-58} textAnchor="middle" style={{ fill: "#f0b862" }}>
          sees it ≥ {minEl}°
        </text>
        <text x={0} y={8} textAnchor="middle">
          Earth
        </text>
      </svg>
    </div>
  );
}
