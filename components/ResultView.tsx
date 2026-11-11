"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getOldestObject } from "@/lib/data";
import { formatDate } from "@/lib/format";
import type { OrbitalObject } from "@/lib/types";
import InfoCard from "./InfoCard";
import LoadingState from "./LoadingState";
import ObjectHero from "./ObjectHero";
import PassInfo from "./PassInfo";

export default function ResultView({ city }: { city: string }) {
  const [object, setObject] = useState<OrbitalObject | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getOldestObject(city).then(setObject).catch(() => setFailed(true));
  }, [city]);

  if (failed) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="font-serif text-3xl font-light">We couldn’t look that up</h1>
        <p className="mt-3 text-muted">Check your connection and try again.</p>
        <Link href="/" className="btn-primary mt-8">Try again</Link>
      </div>
    );
  }

  if (!object) return <LoadingState city={city} />;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24">
      <div className="flex items-center justify-between py-3 text-sm text-muted">
        <Link href="/" className="py-2 hover:text-ink">Search again</Link>
        <span>Sample data for {city}</span>
      </div>

      <ObjectHero object={object} />

      <div className="reveal-4 animate-fade-up space-y-16">
        <blockquote className="max-w-2xl border-l border-accent/60 pl-6 font-serif text-2xl leading-relaxed sm:text-3xl">
          {object.historicalFact}
        </blockquote>

        <PassInfo
          start={object.passStart}
          peak={object.nextPass}
          end={object.passEnd}
          maxElevation={object.maxElevation}
        />

        <section>
          <div className="relative overflow-hidden rounded-xl border border-line bg-panel/60 p-6 sm:p-8">
            <img
              src="/images/external/earth-eastern-hemisphere.jpg"
              alt="Earth viewed from space"
              width={2048}
              height={2048}
              className="absolute inset-0 h-full w-full object-cover opacity-20"
            />
            <div className="relative">
              <p className="label">Archive context</p>
              <h2 className="mt-2 font-serif text-2xl">A planet full of old signals</h2>
              <p className="mt-3 max-w-xl text-muted">
                This globe is a visual reference only. The result above is sample data, not a verified pass prediction.
              </p>
              <p className="mt-5 text-xs text-muted/80">Earth image: NASA Blue Marble / Wikimedia Commons</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl">About this object</h2>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
            <InfoCard label="Launch date" value={formatDate(object.launchDate)} />
            <InfoCard label="Country" value={object.country} />
            <InfoCard label="Purpose" value={object.purpose} />
            <InfoCard label="NORAD ID" value={String(object.noradId).padStart(5, "0")} />
          </dl>
        </section>

        <Link href={`/object/${object.noradId}`} className="btn-primary">Read the full story</Link>
      </div>
    </div>
  );
}
