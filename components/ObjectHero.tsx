import type { OrbitalObject } from "@/lib/types";
import SatelliteArt from "./SatelliteArt";
import StatusBadge from "./StatusBadge";

export default function ObjectHero({ object }: { object: OrbitalObject }) {
  return (
    <section className="grid items-center gap-10 py-8 md:grid-cols-2 md:py-16">
      <div>
        <p className="animate-fade-up text-lg text-muted">Sample archive result for this search</p>
        <h1 className="reveal-1 mt-3 animate-fade-up font-serif text-6xl font-light md:text-7xl">
          {object.name}
        </h1>
        <div className="reveal-2 mt-6 animate-fade-up">
          <StatusBadge status={object.status} />
        </div>
        <div className="reveal-3 mt-10 flex animate-fade-up gap-10 border-t border-line pt-6">
          <div>
            <p className="label">Launched in</p>
            <p className="mt-1 font-serif text-4xl">{object.launchYear}</p>
          </div>
          <div>
            <p className="label">Still in orbit after</p>
            <p className="mt-1 font-serif text-4xl">{object.age} years</p>
          </div>
        </div>
      </div>
      <div className="reveal-1 mx-auto w-full max-w-xs animate-fade-up md:max-w-sm">
        <SatelliteArt />
      </div>
    </section>
  );
}
