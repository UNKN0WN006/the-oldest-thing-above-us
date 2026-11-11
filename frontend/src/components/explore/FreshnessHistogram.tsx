import type { SatelliteListItem } from "@/lib/api/types";

const BINS = [
  { label: "< 1 d", max: 1 },
  { label: "1–2 d", max: 2 },
  { label: "2–4 d", max: 4 },
  { label: "4–7 d", max: 7 },
  { label: "7–14 d", max: 14 },
  { label: "14–30 d", max: 30 },
  { label: "> 30 d", max: Infinity },
];

/** Real distribution of element-set ages in the current dataset. */
export function FreshnessHistogram({ items }: { items: SatelliteListItem[] }) {
  const ages = items.flatMap((i) => (i.provenance ? [Math.abs(i.provenance.element_age_days)] : []));
  const counts = BINS.map((b, i) => ages.filter((a) => a < b.max && a >= (BINS[i - 1]?.max ?? 0)).length);
  const max = Math.max(1, ...counts);
  const missing = items.length - ages.length;
  const w = 560;
  const h = 200;
  const bw = w / BINS.length;
  return (
    <figure style={{ margin: 0 }}>
      <svg className="histogram" viewBox={`0 0 ${w} ${h + 36}`} role="img" aria-label={`Ages of the ${ages.length} element sets in use: ${BINS.map((b, i) => `${counts[i]} are ${b.label}`).join(", ")}.`}>
        {BINS.map((b, i) => {
          const bh = (counts[i]! / max) * (h - 24);
          const color = b.max <= 7 ? "#6cb6ff" : b.max <= 30 ? "#f0b862" : "#ff8f8f";
          return (
            <g key={b.label}>
              <rect x={i * bw + 6} y={h - bh} width={bw - 12} height={Math.max(bh, 1)} rx={4} fill={color} opacity={0.85} />
              <text x={i * bw + bw / 2} y={h - bh - 6} textAnchor="middle" style={{ fill: "#eaf2ff" }}>
                {counts[i]}
              </text>
              <text x={i * bw + bw / 2} y={h + 18} textAnchor="middle">
                {b.label}
              </text>
            </g>
          );
        })}
        <line x1={0} x2={w} y1={h} y2={h} stroke="rgba(142,176,255,0.3)" />
      </svg>
      <figcaption className="muted" style={{ fontSize: "0.85rem", marginTop: "0.6rem" }}>
        Age of each spacecraft&apos;s newest element set, from the data in use now. Blue is fresh, amber is still used
        with a caution, red is not propagated. {missing > 0 ? `${missing} spacecraft have no public element set at all.` : ""}
      </figcaption>
    </figure>
  );
}
