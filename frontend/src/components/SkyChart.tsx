import type { PassModel } from "@/lib/api/types";
import { utcTime } from "@/lib/format";

const R = 100;

/** Polar projection: zenith at the centre, horizon at the rim, north up, east to the LEFT (as seen looking up). */
function project(azimuthDeg: number, elevationDeg: number): [number, number] {
  const r = ((90 - Math.max(0, elevationDeg)) / 90) * R;
  const a = (azimuthDeg * Math.PI) / 180;
  return [-r * Math.sin(a), -r * Math.cos(a)];
}

export function SkyChart({ pass, minElevationDeg }: { pass: PassModel; minElevationDeg: number }) {
  const points = pass.track.map((p) => project(p.azimuth_deg, p.elevation_deg));
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [sx, sy] = project(pass.start.azimuth_deg, pass.start.elevation_deg);
  const [cx, cy] = project(pass.culmination.azimuth_deg, pass.culmination.elevation_deg);
  const [ex, ey] = project(pass.end.azimuth_deg, pass.end.elevation_deg);
  const thresholdR = ((90 - minElevationDeg) / 90) * R;
  const description =
    `Sky chart of the pass. It enters the ${pass.start.compass} at ${utcTime(pass.start.time)} UTC, ` +
    `peaks ${pass.culmination.elevation_deg.toFixed(0)} degrees high in the ${pass.culmination.compass}, ` +
    `and leaves in the ${pass.end.compass} at ${utcTime(pass.end.time)} UTC.`;

  return (
    <svg className="skychart" viewBox="-125 -125 250 250" role="img" aria-label={description}>
      <defs>
        <radialGradient id="sky-fill">
          <stop offset="0%" stopColor="rgba(108,182,255,0.18)" />
          <stop offset="100%" stopColor="rgba(108,182,255,0.02)" />
        </radialGradient>
      </defs>
      <circle r={R} fill="url(#sky-fill)" stroke="rgba(142,176,255,0.45)" />
      <circle r={(R * 2) / 3} fill="none" stroke="rgba(142,176,255,0.14)" />
      <circle r={R / 3} fill="none" stroke="rgba(142,176,255,0.14)" />
      <circle r={thresholdR} fill="none" stroke="#f0b862" strokeOpacity="0.55" strokeDasharray="3 4" />
      <line x1={-R} x2={R} stroke="rgba(142,176,255,0.14)" />
      <line y1={-R} y2={R} stroke="rgba(142,176,255,0.14)" />
      <text y={-R - 8} textAnchor="middle">N</text>
      <text y={R + 16} textAnchor="middle">S</text>
      <text x={-R - 10} y={3} textAnchor="middle">E</text>
      <text x={R + 10} y={3} textAnchor="middle">W</text>
      <text x={4} y={-R / 3 + 10}>60°</text>
      <text x={4} y={(-R * 2) / 3 + 10}>30°</text>
      {points.length > 1 && <path d={path} fill="none" stroke="#a9d4ff" strokeWidth="2" strokeLinecap="round" />}
      <circle cx={sx} cy={sy} r="3.5" fill="#02040a" stroke="#a9d4ff" strokeWidth="1.5" />
      <circle cx={ex} cy={ey} r="3.5" fill="#a9d4ff" />
      <circle cx={cx} cy={cy} r="4.5" fill="#ffffff" />
      <text x={sx + 6} y={sy - 6}>{utcTime(pass.start.time)}</text>
      <text x={ex + 6} y={ey + 12}>{utcTime(pass.end.time)}</text>
    </svg>
  );
}
