import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LocalPasses } from "@/components/history/LocalPasses";
import { OrbitView } from "@/components/history/OrbitView";
import { ProvenanceLine } from "@/components/Provenance";
import { Limitations, Sources } from "@/components/Sources";
import { api, ApiError } from "@/lib/api/client";
import type { SatelliteDetail } from "@/lib/api/types";
import { km, partialDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function load(id: string): Promise<SatelliteDetail> {
  const noradId = Number(id);
  if (!Number.isInteger(noradId) || noradId <= 0) notFound();
  try {
    return await api.satellite(noradId);
  } catch (e) {
    if (e instanceof ApiError && e.kind === "not_found") notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  try {
    const d = await load(id);
    return { title: `${d.satellite.display_name} (${d.satellite.launch_year})`, description: d.story?.summary };
  } catch {
    return { title: "Spacecraft" };
  }
}

export default async function SatellitePage({ params }: Params) {
  const { id } = await params;
  const d = await load(id);
  const s = d.satellite;
  const e = d.elements;

  return (
    <div className="page">
      <nav aria-label="Breadcrumb" className="muted" style={{ fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        <Link href="/discover">Discover</Link> / <Link href="/graveyard">Space Graveyard</Link> / {s.display_name}
      </nav>

      <header className="history-hero">
        <div>
          <div className="history-hero__year" aria-hidden="true">
            {s.launch_year}
          </div>
          <p className="eyebrow">
            {s.country} · {d.story?.mission_type ?? "Catalogue record"}
          </p>
          <h1 style={{ fontSize: "clamp(2.4rem, 5.5vw, 4.6rem)" }}>{s.display_name}</h1>
          <p className="lede" style={{ marginTop: "1.2rem" }}>
            {d.story?.tagline ?? `Catalogued as ${s.name}. No curated story has been written for this object yet.`}
          </p>
          <dl className="datalist" style={{ marginTop: "1.8rem" }}>
            <div>
              <dt>Launched (UTC)</dt>
              <dd>{partialDate(s.launch_date)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{s.fate_label}</dd>
            </div>
            {s.decay_date && (
              <div>
                <dt>Re-entered</dt>
                <dd>{partialDate(s.decay_date)}</dd>
              </div>
            )}
            {d.story?.last_contact && (
              <div>
                <dt>Last contact</dt>
                <dd>{partialDate(d.story.last_contact)}</dd>
              </div>
            )}
            <div>
              <dt>Catalogue</dt>
              <dd className="mono">
                NORAD {s.norad_id} · {s.cospar_id}
              </dd>
            </div>
          </dl>
          <p className="muted" style={{ fontSize: "0.82rem", marginTop: "1rem" }}>
            Launch date:{" "}
            {s.launch_date_verification === "satcat+curated"
              ? "CelesTrak SATCAT, and it matches our curated record."
              : s.launch_date_verification === "satcat"
                ? "CelesTrak SATCAT (no curated record to cross-check)."
                : "CelesTrak SATCAT — our curated record disagrees and is under review."}
          </p>
        </div>
        {e?.tle_line1 && e.tle_line2 ? (
          <OrbitView
            noradId={s.norad_id}
            name={s.display_name}
            tle1={e.tle_line1}
            tle2={e.tle_line2}
            referenceTime={new Date(new Date(e.provenance.element_epoch).getTime() + e.provenance.element_age_days * 86_400_000).toISOString()}
            apogeeKm={e.apogee_km}
          />
        ) : (
          <div className="notice notice--info">
            <strong>No orbit to draw.</strong>
            <p>{d.elements_unavailable_reason}</p>
          </div>
        )}
      </header>

      {d.story ? (
        <>
          <section className="section split" aria-labelledby="story">
            <div className="prose">
              <h2 id="story" style={{ marginBottom: "1.2rem" }}>
                The story
              </h2>
              <p>{d.story.summary}</p>
              <p>{d.story.significance}</p>
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                Operator: {d.story.operator}
              </p>
            </div>
            <div>
              {d.story.facts.length > 0 && (
                <ul className="facts" aria-label="Key facts">
                  {d.story.facts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="section split" aria-labelledby="timeline">
            <h2 id="timeline">Timeline</h2>
            <ol className="timeline">
              {d.story.timeline.map((t) => (
                <li key={t.date + t.label}>
                  <time dateTime={t.date}>{partialDate(t.date)}</time>
                  {t.label}
                </li>
              ))}
              {s.decay_date && (
                <li>
                  <time dateTime={s.decay_date}>{partialDate(s.decay_date)}</time>
                  Re-entered the atmosphere (CelesTrak SATCAT decay date)
                </li>
              )}
            </ol>
          </section>
        </>
      ) : (
        <section className="section">
          <div className="notice notice--info">
            <strong>Catalogue record only.</strong>
            <p>
              This object is in the searched set because of its launch date, but nobody has written and sourced its
              story yet. The facts on this page come directly from CelesTrak.
            </p>
          </div>
        </section>
      )}

      {e && (
        <section className="section" aria-labelledby="orbit">
          <h2 id="orbit">Its orbit today</h2>
          <dl className="datalist panel" style={{ marginBottom: "1.2rem" }}>
            <div>
              <dt>Period</dt>
              <dd>{e.period_min.toFixed(1)} min</dd>
            </div>
            <div>
              <dt>Lowest point</dt>
              <dd>{km(e.perigee_km)}</dd>
            </div>
            <div>
              <dt>Highest point</dt>
              <dd>{km(e.apogee_km)}</dd>
            </div>
            <div>
              <dt>Inclination</dt>
              <dd>{e.inclination_deg.toFixed(2)}°</dd>
            </div>
            <div>
              <dt>Eccentricity</dt>
              <dd>{e.eccentricity.toFixed(4)}</dd>
            </div>
          </dl>
          <ProvenanceLine provenance={e.provenance} />
          {e.tle_line1 && (
            <details className="disclosure" style={{ marginTop: "1.2rem" }}>
              <summary>
                <span>Element set as two lines (TLE)</span>
              </summary>
              <div>
                <pre className="tle" data-testid="tle">
                  {e.tle_line1}
                  {"\n"}
                  {e.tle_line2}
                </pre>
                <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.6rem" }}>
                  Re-encoded from CelesTrak&apos;s OMM record. <Link href="/explore#decoder">Learn to read it</Link>.
                </p>
              </div>
            </details>
          )}
        </section>
      )}

      {s.on_orbit && e && (
        <section className="section" aria-labelledby="passes">
          <h2 id="passes" style={{ marginBottom: "1rem" }}>
            Passes over you
          </h2>
          <LocalPasses noradId={s.norad_id} name={s.display_name} />
        </section>
      )}

      <section className="section split" aria-labelledby="sources">
        <div>
          <h2 id="sources" style={{ marginBottom: "1.2rem" }}>
            Sources
          </h2>
          <Sources sources={d.sources} />
        </div>
        <div>
          {d.story && (
            <div className="notice" role="note" data-testid="editorial-note">
              <strong>Editorial status: draft.</strong>
              <p>{d.story.editorial_note}</p>
            </div>
          )}
          <details className="disclosure" style={{ marginTop: "1.5rem" }}>
            <summary>
              <span>Limits of the predictions</span>
            </summary>
            <div>
              <Limitations items={d.limitations} />
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}
