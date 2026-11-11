import type { Metadata } from "next";
import Link from "next/link";

import { ElementDecoder } from "@/components/explore/ElementDecoder";
import { FreshnessHistogram } from "@/components/explore/FreshnessHistogram";
import { OrbitLab, type Preset } from "@/components/explore/OrbitLab";
import { api } from "@/lib/api/client";

export const metadata: Metadata = { title: "Educational Explorer" };
export const dynamic = "force-dynamic";

const PRESET_IDS = [25544, 20580, 29, 5, 8820, 858];

function Scene({ sunlit, dark }: { sunlit: boolean; dark: boolean }) {
  return (
    <svg viewBox="0 0 200 110" aria-hidden="true">
      <rect width="200" height="110" rx="8" fill={dark ? "#040813" : "#16335f"} />
      {!dark && <circle cx="168" cy="26" r="11" fill="#f0b862" />}
      <path d="M0,96 Q100,74 200,96 L200,110 L0,110 Z" fill="#0b1428" stroke="rgba(142,200,255,0.4)" />
      <path d="M30,84 Q100,10 172,80" fill="none" stroke="rgba(169,212,255,0.35)" strokeDasharray="3 4" />
      <circle cx="100" cy="36" r={sunlit ? 4 : 3} fill={sunlit ? "#ffffff" : "none"} stroke="#a9d4ff" />
      <circle cx="64" cy="90" r="2.5" fill="#f0b862" />
    </svg>
  );
}

export default async function ExplorePage() {
  const list = await api.satellites();
  const presets: Preset[] = PRESET_IDS.flatMap((id) => {
    const s = list.items.find((i) => i.satellite.norad_id === id)?.satellite;
    if (!s || s.apogee_km == null || s.perigee_km == null) return [];
    return [{ name: s.display_name.replace(/ \(.*\)/, "").replace("International Space Station", "ISS").replace("Hubble Space Telescope", "Hubble"), altitudeKm: (s.apogee_km + s.perigee_km) / 2 }];
  });
  const curated = list.items.filter((i) => i.satellite.has_story);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Educational Explorer</p>
        <h1>The ideas behind a pass prediction, one at a time.</h1>
        <p className="lede">
          For students, teachers and astronomy clubs. Every number on this page is either computed in front of you from
          a stated formula or read from the same orbital data the rest of the site uses.
        </p>
      </header>

      <section aria-labelledby="lab">
        <p className="eyebrow">1 · Orbit lab</p>
        <h2 id="lab" style={{ marginBottom: "1.5rem" }}>
          Higher means slower.
        </h2>
        <OrbitLab presets={presets} />
      </section>

      <section className="section" id="decoder" aria-labelledby="decoder-title">
        <p className="eyebrow">2 · Reading an orbit</p>
        <h2 id="decoder-title" style={{ marginBottom: "0.8rem" }}>
          Two lines that pin down an orbit.
        </h2>
        <p className="section__intro">
          Trackers publish each object&apos;s orbit as a compact set of numbers. This is a real, current set from
          CelesTrak. Select any underlined field.
        </p>
        <ElementDecoder items={curated} />
      </section>

      <section className="section split" aria-labelledby="drift">
        <div>
          <p className="eyebrow">3 · Why predictions go stale</p>
          <h2 id="drift" style={{ marginBottom: "1rem" }}>
            An orbit is a snapshot, not a rail.
          </h2>
          <p>
            Air drag, the Sun&apos;s activity and Earth&apos;s uneven gravity keep nudging every orbit. An element set
            is right at its epoch and drifts away from the truth after it — slowly for high orbits, quickly for low
            ones.
          </p>
          <p>
            So Above Us shows the age of the data behind every prediction and refuses to use element sets more than 30
            days from the requested window.
          </p>
        </div>
        <FreshnessHistogram items={list.items} />
      </section>

      <section className="section" aria-labelledby="see">
        <p className="eyebrow">4 · Overhead versus visible</p>
        <h2 id="see" style={{ marginBottom: "0.8rem" }}>
          Four kinds of pass.
        </h2>
        <p className="section__intro">
          To be seen, a satellite has to be lit by the Sun while you stand in darkness. That only happens near dusk and
          dawn for low orbits — and even then the object must be large or shiny enough, which this site does not
          estimate.
        </p>
        <ul className="states">
          <li>
            <Scene sunlit dark />
            <h3>Dark sky, satellite sunlit</h3>
            <p>The geometry observers look for. Big, bright spacecraft such as the ISS can be seen by eye; small ones still cannot.</p>
          </li>
          <li>
            <Scene sunlit dark={false} />
            <h3>Twilight, satellite sunlit</h3>
            <p>The sky is still bright. Only the brightest objects stand out.</p>
          </li>
          <li>
            <Scene sunlit={false} dark={false} />
            <h3>Daylight</h3>
            <p>It passes over, lost in the blue sky.</p>
          </li>
          <li>
            <Scene sunlit={false} dark />
            <h3>In Earth&apos;s shadow</h3>
            <p>Night for you and for the satellite. Nothing lights it, so there is nothing to see.</p>
          </li>
        </ul>
      </section>

      <section className="section" aria-labelledby="class">
        <p className="eyebrow">5 · For the classroom</p>
        <h2 id="class" style={{ marginBottom: "0.8rem" }}>
          Activity ideas
        </h2>
        <p className="notice" style={{ marginBottom: "1.5rem" }}>
          <strong>Draft prompts.</strong> These have not yet been tried with students or reviewed by teachers.
        </p>
        <ol className="activities">
          <li>
            <span>20 min</span>
            <div>
              <h3>Who is older, the satellite or your grandparents?</h3>
              <p>
                Run a <Link href="/discover">discovery</Link> for your city. Place the top five launch dates on a
                timeline with events from your family and your country&apos;s history.
              </p>
            </div>
          </li>
          <li>
            <span>30 min</span>
            <div>
              <h3>Why does Vanguard 1 skip some cities?</h3>
              <p>
                Compare results for Kolkata, London and Tromsø. Find each spacecraft&apos;s inclination in the decoder
                and explain the pattern.
              </p>
            </div>
          </li>
          <li>
            <span>30 min</span>
            <div>
              <h3>Predict before you compute</h3>
              <p>
                Use the orbit lab to estimate how many laps a satellite at 500 km makes in a day. Then check the pass
                table: how many of those laps came within sight of you, and why not all of them?
              </p>
            </div>
          </li>
          <li>
            <span>40 min</span>
            <div>
              <h3>What should happen to dead satellites?</h3>
              <p>
                Read two entries in the <Link href="/graveyard">Space Graveyard</Link> — one that re-entered and one
                still in orbit. Debate who is responsible for a spacecraft after its mission ends.
              </p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
