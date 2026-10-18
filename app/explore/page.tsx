import Link from "next/link";
import { getObjectById } from "@/lib/data";

export default async function ExplorePage() {
  const object = await getObjectById("5");

  return (
    <section className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
      <p className="label">The archive · demo collection</p>
      <h1 className="mt-3 max-w-2xl font-serif text-5xl font-light sm:text-7xl">Explore objects above us</h1>
      <p className="mt-6 max-w-xl text-lg text-muted">
        Browse the sample record currently powering OrbitPast. More objects will arrive with the archive integration.
      </p>
      {object && (
        <Link href={`/object/${object.noradId}`} className="mt-12 block max-w-xl rounded-xl border border-line bg-panel/60 p-6 hover:border-accent/60">
          <p className="label">Sample object</p>
          <h2 className="mt-2 font-serif text-3xl">{object.name}</h2>
          <p className="mt-3 text-muted">{object.historicalFact}</p>
          <span className="mt-6 inline-block text-sm text-accent">Read the object story →</span>
        </Link>
      )}
    </section>
  );
}
