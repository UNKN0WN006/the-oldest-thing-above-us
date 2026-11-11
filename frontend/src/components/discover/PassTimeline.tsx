import type { Candidate } from "@/lib/api/types";
import { utcTime } from "@/lib/format";

interface Props {
  candidates: Candidate[];
  windowStart: string;
  windowEnd: string;
}

const COLORS: Record<string, string> = {
  dark_sky_sunlit: "#ffffff",
  twilight_sunlit: "#a9d4ff",
  daylight: "#4f86d9",
  eclipsed: "#34507f",
};

/** When each of the oldest candidates is above the threshold, across the whole window. */
export function PassTimeline({ candidates, windowStart, windowEnd }: Props) {
  const t0 = new Date(windowStart).getTime();
  const t1 = new Date(windowEnd).getTime();
  const left = 150;
  const width = 1000;
  const row = 24;
  const top = 26;
  const height = top + candidates.length * row + 30;
  const x = (iso: string) => left + ((new Date(iso).getTime() - t0) / (t1 - t0)) * (width - left - 10);
  const hours = (t1 - t0) / 3_600_000;
  const tickEvery = hours <= 12 ? 1 : hours <= 24 ? 3 : hours <= 48 ? 6 : 12;
  const ticks: number[] = [];
  for (let h = 0; h <= hours + 1e-6; h += tickEvery) ticks.push(h);

  return (
    <div className="table-wrap" style={{ padding: "0.8rem", border: 0 }}>
      <svg
        className="timeline-chart"
        viewBox={`0 0 ${width} ${height}`}
        style={{ minWidth: 860 }}
        role="img"
        aria-label={`Timeline of predicted passes for the ${candidates.length} oldest eligible spacecraft across the window. The same information is in the ranked list below.`}
      >
        {ticks.map((h) => {
          const iso = new Date(t0 + h * 3_600_000).toISOString();
          return (
            <g key={h}>
              <line x1={x(iso)} x2={x(iso)} y1={top - 6} y2={height - 28} stroke="rgba(142,176,255,0.12)" />
              <text x={x(iso)} y={12} textAnchor={h + tickEvery > hours ? "end" : "middle"}>
                {utcTime(iso)}
              </text>
            </g>
          );
        })}
        {candidates.map((c, i) => {
          const y = top + i * row;
          return (
            <g key={c.satellite.norad_id}>
              <text x={0} y={y + 14} style={{ fill: "#c9d6ee" }}>
                {c.satellite.launch_year} {c.satellite.display_name.slice(0, 16)}
              </text>
              <line x1={left} x2={width - 10} y1={y + 10} y2={y + 10} stroke="rgba(142,176,255,0.1)" />
              {c.passes.map((p) => {
                const x0 = x(p.start.time);
                const w = Math.max(3, x(p.end.time) - x0);
                return (
                  <rect key={p.start.time} x={x0} y={y + 4} width={w} height={12} rx={3} fill={COLORS[p.illumination]}>
                    <title>
                      {`${utcTime(p.start.time)}–${utcTime(p.end.time)} UTC, peak ${p.culmination.elevation_deg.toFixed(0)}°. ${p.illumination_label}.`}
                    </title>
                  </rect>
                );
              })}
            </g>
          );
        })}
        <g transform={`translate(${left}, ${height - 12})`}>
          {[
            ["dark_sky_sunlit", "dark sky, sunlit"],
            ["twilight_sunlit", "twilight, sunlit"],
            ["daylight", "daylight"],
            ["eclipsed", "in Earth's shadow"],
          ].map(([key, label], i) => (
            <g key={key} transform={`translate(${i * 190}, 0)`}>
              <rect width={14} height={8} y={-8} rx={2} fill={COLORS[key!]} />
              <text x={20}>{label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
