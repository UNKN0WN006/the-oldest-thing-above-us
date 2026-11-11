import type { GraveyardEntry } from "@/lib/api/types";

const yearOf = (iso: string) => {
  const d = new Date(iso.length === 4 ? `${iso}-07-01` : iso.length === 7 ? `${iso}-15` : iso);
  return d.getUTCFullYear() + d.getUTCMonth() / 12 + d.getUTCDate() / 365;
};

/** One line per curated mission: working life (bright), silent years in orbit (dim), re-entry (mark). */
export function Lifelines({ entries, nowIso }: { entries: GraveyardEntry[]; nowIso: string }) {
  const rows = [...entries].sort((a, b) => a.satellite.launch_date.localeCompare(b.satellite.launch_date));
  const now = yearOf(nowIso);
  const from = 1955;
  const to = Math.ceil(now / 5) * 5;
  const left = 170;
  const width = 1000;
  const row = 22;
  const top = 28;
  const height = top + rows.length * row + 34;
  const x = (year: number) => left + ((year - from) / (to - from)) * (width - left - 16);
  const decades: number[] = [];
  for (let y = 1960; y <= to; y += 10) decades.push(y);

  return (
    <div className="table-wrap" style={{ border: 0 }}>
      <svg
        className="lifelines"
        viewBox={`0 0 ${width} ${height}`}
        style={{ minWidth: 860 }}
        role="img"
        aria-label={`Lifelines of ${rows.length} curated missions from launch to re-entry or to today. Each mission is also listed as a card below.`}
      >
        {decades.map((y) => (
          <g key={y}>
            <line x1={x(y)} x2={x(y)} y1={top - 8} y2={height - 30} stroke="rgba(142,176,255,0.12)" />
            <text x={x(y)} y={12} textAnchor="middle">
              {y}
            </text>
          </g>
        ))}
        {rows.map((e, i) => {
          const y = top + i * row + 8;
          const launch = yearOf(e.satellite.launch_date);
          const end = e.satellite.decay_date ? yearOf(e.satellite.decay_date) : now;
          const silent = e.last_contact ? Math.min(end, Math.max(launch, yearOf(e.last_contact))) : null;
          return (
            <g key={e.satellite.norad_id}>
              <text className="name" x={0} y={y + 4}>
                {e.satellite.display_name.length > 24 ? `${e.satellite.display_name.slice(0, 23)}…` : e.satellite.display_name}
              </text>
              <line x1={x(launch)} x2={x(end)} y1={y} y2={y} stroke="#34507f" strokeWidth={3} strokeLinecap="round" />
              {silent !== null && <line x1={x(launch)} x2={Math.max(x(silent), x(launch) + 2)} y1={y} y2={y} stroke="#a9d4ff" strokeWidth={3} strokeLinecap="round" />}
              <circle cx={x(launch)} cy={y} r={3.5} fill="#a9d4ff" />
              {e.satellite.decay_date ? (
                <path d={`M${x(end) - 4},${y - 4} L${x(end) + 4},${y + 4} M${x(end) - 4},${y + 4} L${x(end) + 4},${y - 4}`} stroke="#f0b862" strokeWidth={1.8} />
              ) : (
                <path d={`M${x(end)},${y - 4} L${x(end) + 6},${y} L${x(end)},${y + 4} Z`} fill="#34507f" />
              )}
            </g>
          );
        })}
        <g transform={`translate(${left}, ${height - 10})`}>
          <line x1={0} x2={22} y1={-3} y2={-3} stroke="#a9d4ff" strokeWidth={3} />
          <text x={28}>launch to last recorded contact</text>
          <line x1={250} x2={272} y1={-3} y2={-3} stroke="#34507f" strokeWidth={3} />
          <text x={278}>in orbit, silent or contact date not curated</text>
          <path d="M586,-7 L594,1 M586,1 L594,-7" stroke="#f0b862" strokeWidth={1.8} />
          <text x={602}>re-entered</text>
        </g>
      </svg>
    </div>
  );
}
