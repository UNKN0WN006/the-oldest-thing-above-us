"use client";

import Link from "next/link";
import { useState } from "react";

import { ProvenanceLine } from "@/components/Provenance";
import { SkyChart } from "@/components/SkyChart";
import { Limitations, Sources } from "@/components/Sources";
import type { Candidate, DiscoverResponse } from "@/lib/api/types";
import { coordinate, utcDateTime, yearsSince, zonedTime } from "@/lib/format";

import { describePath, PassTable } from "./PassTable";
import { PassTimeline } from "./PassTimeline";

const REASON_LABEL: Record<string, string> = {
  no_pass: "no qualifying pass",
  no_elements: "no public element set",
  stale_elements: "elements too old",
  propagation_error: "propagation error",
};

function CandidateRow({ c, timezone, minEl }: { c: Candidate; timezone?: string; minEl: number }) {
  const [open, setOpen] = useState(false);
  const first = c.passes[0]!;
  const id = `cand-${c.satellite.norad_id}`;
  return (
    <li data-testid="candidate">
      <button type="button" className="ranked__row" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className="ranked__rank">#{c.rank}</span>
        <span className="ranked__year">{c.satellite.launch_year}</span>
        <span className="ranked__name">
          {c.satellite.display_name}
          <small>
            {c.satellite.country} · launched {c.satellite.launch_date}
          </small>
        </span>
        <span className="ranked__next">
          {zonedTime(first.start.time, timezone)} · peak {first.culmination.elevation_deg.toFixed(0)}° {first.culmination.compass}
          <small>
            {c.pass_count} pass{c.pass_count === 1 ? "" : "es"} · highest {c.highest_elevation_deg.toFixed(0)}°
          </small>
        </span>
        <span className="ranked__chev" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div className="ranked__detail" id={id}>
          <div className="split">
            <div>
              <p>{describePath(first)}</p>
              <p className="muted">{c.satellite.tagline ?? `${c.satellite.fate_label}. No curated story yet — catalogue record only.`}</p>
              <Link className="btn btn--quiet" href={`/satellites/${c.satellite.norad_id}`}>
                {c.satellite.has_story ? "Read its history →" : "Open catalogue record →"}
              </Link>
            </div>
            {first.track.length > 1 && <SkyChart pass={first} minElevationDeg={minEl} />}
          </div>
          <PassTable passes={c.passes} timezone={timezone} />
          <ProvenanceLine provenance={c.provenance} />
        </div>
      )}
    </li>
  );
}

export function Results({ data, timezone }: { data: DiscoverResponse; timezone?: string }) {
  const [showAll, setShowAll] = useState(false);
  const place = data.observer.place_name ?? coordinate(data.observer.latitude_deg, data.observer.longitude_deg);
  const oldest = data.oldest;
  const excludedTotal = data.excluded.length;
  const visible = showAll ? data.candidates : data.candidates.slice(0, 12);

  return (
    <div data-testid="results">
      {data.data_mode === "snapshot" && (
        <div className="notice" role="note" style={{ marginBottom: "1.5rem" }}>
          <strong>Demonstration result.</strong> These passes were calculated using archived CelesTrak elements for the
          selected window starting {utcDateTime(data.window_start)}. Check the orbital epochs; these are not live observations.
        </div>
      )}
      {data.data_mode === "mixed" && (
        <div className="notice" role="note" style={{ marginBottom: "1.5rem" }}>
          <strong>Partially refreshed catalogue.</strong> Some spacecraft still use archived orbital elements.
          Check each result&apos;s source and element epoch before relying on a prediction.
        </div>
      )}

      {oldest ? (
        <section className="oldest" aria-labelledby="oldest-title">
          <div>
            <p className="eyebrow">Oldest eligible spacecraft over {place}</p>
            <div className="oldest__year" data-testid="oldest-year">
              {oldest.satellite.launch_year}
            </div>
            <h2 id="oldest-title" data-testid="oldest-name">
              {oldest.satellite.display_name}
            </h2>
            <p className="oldest__claim">
              Launched {oldest.satellite.launch_date}, {yearsSince(oldest.satellite.launch_date, new Date(data.window_start))} years
              before this window. It has the earliest launch date among the {data.candidates.length} spacecraft with a
              qualifying pass, out of {data.methodology.candidate_count} searched.
            </p>
            <div className="oldest__actions">
              <Link className="btn btn--primary" href={`/satellites/${oldest.satellite.norad_id}`}>
                Read its history
              </Link>
              <a className="btn" href="#ranked">
                See all {data.candidates.length} candidates
              </a>
            </div>
            <ProvenanceLine provenance={oldest.provenance} />
          </div>
          <div className="pass-summary">
            <SkyChart pass={oldest.passes[0]!} minElevationDeg={data.min_elevation_deg} />
            <p className="pass-summary__path">
              <strong>First pass: {zonedTime(oldest.passes[0]!.start.time, timezone, true)}.</strong>{" "}
              {describePath(oldest.passes[0]!)}
            </p>
            <p className="muted" style={{ fontSize: "0.88rem", margin: 0 }}>
              {oldest.passes[0]!.illumination_label}. This describes lighting geometry only — it is not a prediction
              that the spacecraft can be seen.
            </p>
          </div>
        </section>
      ) : (
        <div className="notice notice--info" role="status" data-testid="no-results">
          <strong>No spacecraft in the searched set qualifies.</strong>
          <p>
            None of the {data.methodology.candidate_count} candidates has a pass reaching {data.min_elevation_deg}° over{" "}
            {place} in this window with usable orbital data. Try a longer window or a lower elevation threshold. The
            reasons for every exclusion are listed below.
          </p>
        </div>
      )}

      {data.candidates.length > 0 && (
        <>
          <section className="section" aria-labelledby="when">
            <h2 id="when">When they are overhead</h2>
            <p className="section__intro">
              The ten oldest eligible spacecraft across the window, in UTC. Bar colour shows the lighting geometry at
              the peak of each pass.
            </p>
            <PassTimeline candidates={data.candidates.slice(0, 10)} windowStart={data.window_start} windowEnd={data.window_end} />
          </section>

          <section className="section" id="ranked" aria-labelledby="ranked-title">
            <h2 id="ranked-title">Ranked by launch date</h2>
            <p className="section__intro">
              Times are shown {timezone ? `in the city's local time (${timezone})` : "in UTC"}. Select a row for every
              pass, its sky track and the age of its orbital data.
            </p>
            <ol className="ranked">
              {visible.map((c) => (
                <CandidateRow key={c.satellite.norad_id} c={c} timezone={timezone} minEl={data.min_elevation_deg} />
              ))}
            </ol>
            {data.candidates.length > visible.length && (
              <p style={{ marginTop: "1.2rem" }}>
                <button type="button" className="btn" onClick={() => setShowAll(true)}>
                  Show all {data.candidates.length}
                </button>
              </p>
            )}
          </section>
        </>
      )}

      <section className="section" aria-labelledby="fine">
        <h2 id="fine">How this answer was reached</h2>
        <details className="disclosure" data-testid="exclusions">
          <summary>
            <span>
              {excludedTotal} of {data.methodology.candidate_count} searched spacecraft were left out
            </span>
          </summary>
          <div>
            <ul className="counts">
              {Object.entries(data.exclusion_counts).map(([reason, n]) => (
                <li key={reason} className="pill pill--plain">
                  {n} · {REASON_LABEL[reason] ?? reason}
                </li>
              ))}
            </ul>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Launched</th>
                    <th scope="col">Spacecraft</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.excluded.map((e) => (
                    <tr key={e.norad_id}>
                      <td>{e.launch_date}</td>
                      <td>
                        <Link href={`/satellites/${e.norad_id}`}>{e.name}</Link>
                      </td>
                      <td>{REASON_LABEL[e.reason] ?? e.reason}</td>
                      <td className="wrap">{e.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
        <details className="disclosure">
          <summary>
            <span>Candidate set and rules ({data.methodology.candidate_set_version})</span>
          </summary>
          <div className="prose" style={{ fontSize: "0.98rem" }}>
            <p>{data.methodology.candidate_set_description}</p>
            <ol>
              {data.methodology.eligibility_rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
            <p>{data.methodology.ranking_rule}</p>
            <p>{data.methodology.pass_definition}</p>
            <p className="muted">{data.methodology.propagator}</p>
          </div>
        </details>
        <details className="disclosure" open>
          <summary>
            <span>What this cannot tell you</span>
          </summary>
          <div>
            <Limitations items={data.limitations} />
          </div>
        </details>
        <details className="disclosure">
          <summary>
            <span>Data sources</span>
          </summary>
          <div>
            <Sources sources={data.sources} />
            <p className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
              Computed {utcDateTime(data.generated_at)} for {coordinate(data.observer.latitude_deg, data.observer.longitude_deg)},
              window {utcDateTime(data.window_start)} → {utcDateTime(data.window_end)}, threshold {data.min_elevation_deg}°.
            </p>
          </div>
        </details>
      </section>
    </div>
  );
}
