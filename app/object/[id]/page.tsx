import Link from "next/link";
import { notFound } from "next/navigation";
import { getObjectById } from "@/lib/data";
import { formatDate } from "@/lib/format";
import InfoCard from "@/components/InfoCard";
import SatelliteArt from "@/components/SatelliteArt";

export default async function ObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const object = await getObjectById(id);

  if (!object) notFound();

  return (
    <article className="mx-auto max-w-5xl px-5 pb-24">
      <Link href="/result?city=your%20location" className="inline-block py-5 text-sm text-muted hover:text-ink">
        ← Back to the sample result
      </Link>

      <header className="grid items-center gap-10 border-b border-line py-8 md:grid-cols-[1fr_18rem] md:py-16">
        <div>
          <p className="label">Object story · demo archive</p>
          <h1 className="mt-3 font-serif text-6xl font-light md:text-7xl">{object.name}</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            A closer look at the sample record used by this prototype.
          </p>
        </div>
        <SatelliteArt />
      </header>

      <div className="grid gap-16 py-16 md:grid-cols-[1fr_18rem]">
        <div className="space-y-12">
          <section>
            <h2 className="font-serif text-3xl">The story</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted">{object.story}</p>
          </section>
          <section>
            <h2 className="font-serif text-3xl">Mission notes</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted">{object.mission}</p>
          </section>
          <figure className="max-w-2xl">
            <img
              src="/images/external/hubble-in-orbit.jpg"
              alt="The Hubble Space Telescope in orbit above Earth"
              width={1920}
              height={1275}
              className="rounded-xl border border-line opacity-90"
            />
            <figcaption className="mt-2 text-xs text-muted/80">
              Archival reference image, not Vanguard 1: NASA Goddard / Hubble Space Telescope.
            </figcaption>
          </figure>
          <section>
            <h2 className="font-serif text-3xl">Historical timeline</h2>
            <ol className="mt-6 space-y-5 border-l border-line pl-5">
              {object.timeline.map((entry) => (
                <li key={`${entry.year}-${entry.event}`}>
                  <p className="font-serif text-xl">{entry.year}</p>
                  <p className="mt-1 text-muted">{entry.event}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside>
          <p className="label">Sample metadata</p>
          <dl className="mt-4 space-y-6">
            <InfoCard label="Launch date" value={formatDate(object.launchDate)} />
            <InfoCard label="Country" value={object.country} />
            <InfoCard label="Purpose" value={object.purpose} />
            <InfoCard label="NORAD ID" value={String(object.noradId).padStart(5, "0")} />
          </dl>
        </aside>
      </div>
    </article>
  );
}
