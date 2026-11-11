import Link from "next/link";

import { HomeHero } from "@/components/home/HomeHero";

export default function HomePage() {
  return (
    <>
      <HomeHero />

      <div className="page" style={{ paddingTop: "1rem" }}>
        <section className="section" aria-labelledby="how">
          <p className="eyebrow">From city to story</p>
          <h2 id="how">Four steps, each one checkable.</h2>
          <p className="section__intro lede">
            Above Us joins two things that usually live apart: the orbital records that say where an object is, and the
            mission histories that say why it was ever sent up.
          </p>
          <ol className="steps">
            <li>
              <h3>Choose a place and a window</h3>
              <p>A city, or exact coordinates, and the next 24 hours by default. You can change the window and how high above the horizon a pass must reach.</p>
            </li>
            <li>
              <h3>Predict the passes</h3>
              <p>Current element sets from CelesTrak are propagated with SGP4 through Skyfield to find when each spacecraft clears your elevation threshold.</p>
            </li>
            <li>
              <h3>Rank by launch date</h3>
              <p>Everything with a qualifying pass is ordered by its catalogue launch date. The earliest is your oldest thing above you — among the spacecraft we searched.</p>
            </li>
            <li>
              <h3>Open the story</h3>
              <p>Who built it, what it was for, when it fell silent, and where to read more. Every record links to its sources and shows how fresh its orbit data is.</p>
            </li>
          </ol>
        </section>

        <section className="section split" aria-labelledby="honest">
          <div>
            <p className="eyebrow">What a pass is, and is not</p>
            <h2 id="honest">Overhead is not the same as visible.</h2>
          </div>
          <div>
            <p className="lede">
              Vanguard 1 is a 16.5 cm sphere more than 600 km away at its closest. It will pass over much of the world
              today. Almost nobody will see it.
            </p>
            <p>
              So this site predicts geometry — when an object is above your horizon, how high, in which direction — and
              tells you whether the sky is dark and the spacecraft sunlit at that moment. It does not estimate
              brightness, and it never claims you will see something.
            </p>
            <p>
              <Link href="/methodology">Read the method and its limits</Link>
            </p>
          </div>
        </section>

        <section className="section" aria-labelledby="doors">
          <h2 id="doors" className="visually-hidden">
            Explore
          </h2>
          <div className="doors">
            <Link className="door" href="/discover">
              <span>Discovery</span>
              <div>
                <h3>What is the oldest spacecraft passing near my city?</h3>
                <p>Ranked candidates, pass times, sky tracks, and the reasons anything was left out.</p>
              </div>
            </Link>
            <Link className="door" href="/graveyard">
              <span>Space Graveyard</span>
              <div>
                <h3>The silent ones, and the ones that came back.</h3>
                <p>An archive of ended missions: derelicts still in orbit and spacecraft that re-entered.</p>
              </div>
            </Link>
            <Link className="door" href="/explore">
              <span>Educational Explorer</span>
              <div>
                <h3>Why does an orbit take ninety minutes?</h3>
                <p>Hands-on models of orbits, element sets and pass geometry, with classroom prompts.</p>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
