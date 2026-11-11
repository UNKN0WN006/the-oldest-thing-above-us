"use client";

import Link from "next/link";
import { useState } from "react";

import type { GraveyardEntry } from "@/lib/api/types";
import { partialDate } from "@/lib/format";

type Tab = "orbiting" | "reentered" | "catalogue";

function Card({ e }: { e: GraveyardEntry }) {
  const s = e.satellite;
  return (
    <li>
      <Link className="grave" href={`/satellites/${s.norad_id}`}>
        <span className="grave__dates">
          {s.launch_year} — {s.decay_date ? s.decay_date.slice(0, 4) : "still in orbit"}
        </span>
        <h3>{s.display_name}</h3>
        <p>{s.tagline}</p>
        <span className="grave__meta">
          {s.country} · {s.fate_label}
          {e.last_contact ? ` · last contact ${partialDate(e.last_contact)}` : ""} ·{" "}
          {e.years_in_orbit >= 1 ? `${Math.round(e.years_in_orbit)} years` : `${Math.round(e.years_in_orbit * 365)} days`} in orbit
        </span>
      </Link>
    </li>
  );
}

export function GraveyardTabs({ orbiting, reentered, catalogue }: { orbiting: GraveyardEntry[]; reentered: GraveyardEntry[]; catalogue: GraveyardEntry[] }) {
  const [tab, setTab] = useState<Tab>("orbiting");
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "orbiting", label: "Silent, still in orbit", count: orbiting.length },
    { id: "reentered", label: "Returned to Earth", count: reentered.length },
    { id: "catalogue", label: "Catalogue only", count: catalogue.length },
  ];
  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Archive sections">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)}>
            {t.label} <span className="muted">{t.count}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "orbiting" && (
          <ul className="graves">
            {orbiting.map((e) => (
              <Card key={e.satellite.norad_id} e={e} />
            ))}
          </ul>
        )}
        {tab === "reentered" && (
          <ul className="graves">
            {reentered.map((e) => (
              <Card key={e.satellite.norad_id} e={e} />
            ))}
          </ul>
        )}
        {tab === "catalogue" && (
          <>
            <p className="section__intro muted">
              Early payloads that CelesTrak lists as still in orbit and that are part of the searched set, but whose
              stories have not been written and sourced yet. Their operating status is not curated; almost all are
              long silent.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Launched</th>
                    <th scope="col">Catalogue name</th>
                    <th scope="col">Owner</th>
                    <th scope="col">SATCAT status</th>
                    <th scope="col">Orbit (perigee × apogee)</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogue.map((e) => (
                    <tr key={e.satellite.norad_id}>
                      <td>{e.satellite.launch_date}</td>
                      <td>
                        <Link href={`/satellites/${e.satellite.norad_id}`}>{e.satellite.name}</Link>
                      </td>
                      <td>{e.satellite.country}</td>
                      <td>{e.satellite.ops_status_label}</td>
                      <td>
                        {e.satellite.perigee_km ?? "—"} × {e.satellite.apogee_km ?? "—"} km
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
