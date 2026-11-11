"use client";

import { useState } from "react";

import { ProvenanceLine } from "@/components/Provenance";
import type { SatelliteListItem } from "@/lib/api/types";

interface Field {
  id: string;
  line: 1 | 2;
  /** 1-based inclusive column range in the 69-character line. */
  from: number;
  to: number;
  title: string;
  explain: (raw: string) => string;
}

const FIELDS: Field[] = [
  { id: "cat", line: 1, from: 3, to: 7, title: "Catalogue number", explain: (v) => `Object ${Number(v)} in the satellite catalogue. Numbers are handed out in the order objects are first tracked, so small numbers mean early spaceflight.` },
  { id: "intl", line: 1, from: 10, to: 17, title: "International designator", explain: (v) => `Launch year (${v.slice(0, 2)}), the number of that launch within the year (${v.slice(2, 5)}), and a letter for each piece that launch put in orbit (${v.slice(5).trim()}).` },
  { id: "epoch", line: 1, from: 19, to: 32, title: "Epoch", explain: (v) => `The moment these numbers describe: year '${v.slice(0, 2)}, day ${v.slice(2, 5)} of the year, plus a fraction of a day. Predictions are most accurate close to this time.` },
  { id: "bstar", line: 1, from: 54, to: 61, title: "Drag term (B*)", explain: () => "How strongly the thin upper atmosphere slows this object. Low, light objects have larger values; high orbits are close to zero." },
  { id: "inc", line: 2, from: 9, to: 16, title: "Inclination", explain: (v) => `The orbit is tilted ${Number(v).toFixed(2)}° to the equator. The spacecraft never travels over latitudes higher than this, which is why some old satellites never pass over northern cities.` },
  { id: "raan", line: 2, from: 18, to: 25, title: "Right ascension of the ascending node", explain: (v) => `${Number(v).toFixed(2)}°: where the orbit crosses the equator going north, measured against the stars. It sets which way the tilted orbit faces.` },
  { id: "ecc", line: 2, from: 27, to: 33, title: "Eccentricity", explain: (v) => `0.${v} with the decimal point left out. Zero is a perfect circle; larger values are more stretched ellipses.` },
  { id: "argp", line: 2, from: 35, to: 42, title: "Argument of perigee", explain: (v) => `${Number(v).toFixed(2)}°: where around the orbit the lowest point lies.` },
  { id: "ma", line: 2, from: 44, to: 51, title: "Mean anomaly", explain: (v) => `${Number(v).toFixed(2)}°: how far around its lap the spacecraft was at the epoch.` },
  { id: "mm", line: 2, from: 53, to: 63, title: "Mean motion", explain: (v) => `${Number(v).toFixed(4)} orbits per day, so one lap takes about ${(1440 / Number(v)).toFixed(1)} minutes.` },
  { id: "rev", line: 2, from: 64, to: 68, title: "Orbit count", explain: (v) => `Laps completed at the epoch: ${Number(v).toLocaleString("en-GB")}. The field has only five digits, so for very old satellites it has wrapped around.` },
];

function Line({ text, line, active, onPick }: { text: string; line: 1 | 2; active: string; onPick: (id: string) => void }) {
  const fields = FIELDS.filter((f) => f.line === line);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const f of fields) {
    if (f.from - 1 > cursor) parts.push(text.slice(cursor, f.from - 1));
    parts.push(
      <button key={f.id} type="button" aria-pressed={active === f.id} aria-label={`${f.title}: ${text.slice(f.from - 1, f.to).trim()}`} onClick={() => onPick(f.id)}>
        {text.slice(f.from - 1, f.to)}
      </button>,
    );
    cursor = f.to;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export function ElementDecoder({ items }: { items: SatelliteListItem[] }) {
  const usable = items.filter((i) => i.tle_line1 && i.tle_line2);
  const [id, setId] = useState(usable[0]?.satellite.norad_id ?? 0);
  const [active, setActive] = useState("inc");
  const item = usable.find((i) => i.satellite.norad_id === id) ?? usable[0];
  if (!item) return <p className="notice notice--info">No element sets are available to decode right now.</p>;
  const field = FIELDS.find((f) => f.id === active)!;
  const source = field.line === 1 ? item.tle_line1! : item.tle_line2!;
  const raw = source.slice(field.from - 1, field.to);

  return (
    <div>
      <div className="field" style={{ maxWidth: "24rem", marginBottom: "1rem" }}>
        <label htmlFor="decoder-sat">Spacecraft</label>
        <select id="decoder-sat" className="select" value={item.satellite.norad_id} onChange={(e) => setId(Number(e.target.value))}>
          {usable.map((i) => (
            <option key={i.satellite.norad_id} value={i.satellite.norad_id}>
              {i.satellite.launch_year} · {i.satellite.display_name}
            </option>
          ))}
        </select>
      </div>
      <pre className="tle" aria-label="Two-line element set. Select a highlighted field to see what it means.">
        <Line text={item.tle_line1!} line={1} active={active} onPick={setActive} />
        {"\n"}
        <Line text={item.tle_line2!} line={2} active={active} onPick={setActive} />
      </pre>
      <div className="panel" style={{ marginTop: "1rem" }} aria-live="polite" data-testid="decoder-explain">
        <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>
          {field.title}
        </p>
        <p style={{ margin: 0 }}>{field.explain(raw)}</p>
      </div>
      {item.provenance && (
        <div style={{ marginTop: "1rem" }}>
          <ProvenanceLine provenance={item.provenance} />
        </div>
      )}
    </div>
  );
}
