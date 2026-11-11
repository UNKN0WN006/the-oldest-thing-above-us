import type { Metadata } from "next";

import { Limitations, Sources } from "@/components/Sources";
import { api } from "@/lib/api/client";
import { utcDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Method and limits" };
export const dynamic = "force-dynamic";

export default async function MethodologyPage() {
  const [doc, status] = await Promise.all([api.methodology(), api.status()]);
  const m = doc.methodology;

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Method and limits</p>
        <h1>How the answer is worked out, and where it stops being reliable.</h1>
        <p className="lede">
          &ldquo;The oldest thing above you&rdquo; is a precise claim only if the search behind it is stated. This page
          states it.
        </p>
      </header>

      <section className="split" aria-labelledby="now">
        <div>
          <h2 id="now" style={{ marginBottom: "1rem" }}>
            Data in use right now
          </h2>
          <p>
            <span className={`pill ${status.data_mode === "live" ? "pill--live" : "pill--archived"}`}>{status.data_mode === "live" ? "Live" : status.data_mode === "mixed" ? "Mixed" : "Archived"}</span>
          </p>
          <p>{status.data_mode_label}.</p>
        </div>
        <dl className="datalist panel" data-testid="status-panel">
          <div>
            <dt>Spacecraft searched</dt>
            <dd>{status.candidate_count}</dd>
          </div>
          <div>
            <dt>Elements fetched live</dt>
            <dd>{status.elements_live}</dd>
          </div>
          <div>
            <dt>Elements from archive</dt>
            <dd>{status.elements_snapshot}</dd>
          </div>
          <div>
            <dt>No public elements</dt>
            <dd>{status.elements_missing}</dd>
          </div>
          <div>
            <dt>Catalogue retrieved</dt>
            <dd>{status.satcat_retrieved_at ? utcDateTime(status.satcat_retrieved_at) : "—"}</dd>
          </div>
          <div>
            <dt>Element epochs</dt>
            <dd>
              {status.oldest_element_epoch ? `${utcDateTime(status.oldest_element_epoch)} → ${utcDateTime(status.newest_element_epoch!)}` : "—"}
            </dd>
          </div>
          <div>
            <dt>Last element retrieval</dt>
            <dd>{status.newest_element_retrieval ? utcDateTime(status.newest_element_retrieval) : "—"}</dd>
          </div>
          {status.refresh?.last_error && (
            <div>
              <dt>Last refresh problem</dt>
              <dd>{status.refresh.last_error}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="section split" aria-labelledby="set">
        <h2 id="set">1. What is searched</h2>
        <div className="prose">
          <p>
            <span className="mono">{m.candidate_set_version}</span> — {m.candidate_set_description}
          </p>
          <p>
            That means the result is the oldest <em>among these {m.candidate_count} spacecraft</em>, not among the tens
            of thousands of tracked objects. Spent rocket stages and fragments, some of them just as old, are outside
            the search.
          </p>
        </div>
      </section>

      <section className="section split" aria-labelledby="rules">
        <h2 id="rules">2. What counts as eligible</h2>
        <div className="prose">
          <ol>
            {m.eligibility_rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          <p>Anything that fails is listed with its reason next to every result:</p>
          <dl>
            {Object.entries(doc.exclusion_reasons).map(([code, text]) => (
              <div key={code} style={{ marginBottom: "0.8rem" }}>
                <dt className="mono" style={{ color: "var(--atmo)" }}>
                  {code}
                </dt>
                <dd style={{ margin: 0 }}>{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section split" aria-labelledby="pass">
        <h2 id="pass">3. What a pass is</h2>
        <div className="prose">
          <p>{m.pass_definition}</p>
          <p>{m.ranking_rule}</p>
          <p className="muted">{m.propagator}</p>
          <p>For each pass we also report the lighting geometry at its highest point. These labels describe sunlight, not visibility:</p>
          <ul>
            {Object.values(doc.illumination_labels).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section split" aria-labelledby="fresh">
        <h2 id="fresh">4. How old the orbit data may be</h2>
        <div className="prose">
          <p>
            An element set describes an orbit at one moment, its epoch. The further a prediction is from that epoch,
            the less it can be trusted, so every result shows the epoch and when we retrieved it.
          </p>
          <ul>
            {Object.entries(doc.freshness_rules).map(([k, v]) => (
              <li key={k}>
                <strong style={{ textTransform: "capitalize" }}>{k}:</strong> {v}
              </li>
            ))}
          </ul>
          <p>
            Element sets are cached and re-requested from CelesTrak at most every six hours per spacecraft, well
            above the two-hour minimum CelesTrak asks of its users. The catalogue is refreshed daily.
          </p>
        </div>
      </section>

      <section className="section split" aria-labelledby="modes">
        <h2 id="modes">5. Live, archived, and mock data</h2>
        <div className="prose">
          <p>
            <strong>Live</strong> means this server fetched the record from CelesTrak itself. <strong>Archived</strong>{" "}
            means a real CelesTrak capture that ships with the code, used for demonstrations and tests; when it is in
            use a banner says so on every page. Archived orbital elements may not be suitable for predictions far from
            the capture period. <strong>Mixed</strong> means the background refresh has updated only part of the catalogue; individual
            element sources and epochs are shown beside the results.
          </p>
          <p>
            There is <strong>no mock orbital data</strong> anywhere in the application. If the data service cannot be
            reached, pages say so instead of showing sample results.
          </p>
        </div>
      </section>

      <section className="section split" aria-labelledby="valid">
        <h2 id="valid">6. How it was checked</h2>
        <div className="prose">
          <p>{doc.validation_summary}</p>
          <p>
            These are comparisons between independent software implementations using the same element sets. They show
            the calculation is done correctly; they do not show that the element sets themselves are perfect, and they
            are not observations of the sky.
          </p>
        </div>
      </section>

      <section className="section split" aria-labelledby="limits">
        <h2 id="limits">7. What it cannot tell you</h2>
        <Limitations items={doc.limitations} />
      </section>

      <section className="section split" aria-labelledby="src">
        <h2 id="src">Sources</h2>
        <Sources sources={doc.sources} />
      </section>
    </div>
  );
}
