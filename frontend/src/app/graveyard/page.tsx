import type { Metadata } from "next";

import { GraveyardTabs } from "@/components/graveyard/GraveyardTabs";
import { Lifelines } from "@/components/graveyard/Lifelines";
import { api } from "@/lib/api/client";

export const metadata: Metadata = { title: "Space Graveyard" };
export const dynamic = "force-dynamic";

export default async function GraveyardPage() {
  const data = await api.graveyard();
  const curatedOrbiting = data.still_orbiting.filter((e) => e.satellite.has_story);
  const catalogueOnly = data.still_orbiting.filter((e) => !e.satellite.has_story);
  const curated = [...curatedOrbiting, ...data.reentered];

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Space Graveyard</p>
        <h1>Missions end. The machines do not always come down.</h1>
        <p className="lede">
          An archive of spacecraft whose work is over. Some burned up within months. Others fell silent decades ago and
          are still up there, circling on schedule with nobody listening.
        </p>
      </header>

      <section aria-labelledby="lifelines">
        <h2 id="lifelines" style={{ marginBottom: "0.8rem" }}>
          Lifelines
        </h2>
        <p className="section__intro">
          Each line runs from launch to re-entry, or to today. The bright part is the working life where a last-contact
          date has been curated; everything after it is silence.
        </p>
        <Lifelines entries={curated} nowIso={data.generated_at} />
      </section>

      <section className="section" aria-labelledby="archive">
        <h2 id="archive" style={{ marginBottom: "1.2rem" }}>
          The archive
        </h2>
        <GraveyardTabs orbiting={curatedOrbiting} reentered={data.reentered} catalogue={catalogueOnly} />
        <p className="muted" style={{ fontSize: "0.85rem", marginTop: "1.5rem", maxWidth: "68ch" }}>
          {data.note}
        </p>
      </section>
    </div>
  );
}
