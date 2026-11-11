import Link from "next/link";

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
      <p className="label">About OrbitPast</p>
      <h1 className="mt-3 font-serif text-5xl font-light sm:text-7xl">A small museum for the sky.</h1>
      <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted">
        <p>
          OrbitPast is a hackathon prototype about the human-made objects that continue to circle Earth.
          It combines a place search with an object story so looking up can lead to looking back.
        </p>
        <p>
          The current interface uses clearly marked sample data. It does not provide live orbital predictions,
          location detection, pass visibility, or a claim that an object can be seen with the naked eye.
        </p>
      </div>
      <Link href="/explore" className="btn-primary mt-10">Explore the sample archive</Link>
      <section className="mt-16 border-t border-line pt-8">
        <h2 className="font-serif text-2xl">Image credits</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li>NASA / Apollo 8 Earth image</li>
          <li>NASA Goddard / Hubble Space Telescope</li>
          <li>NASA Blue Marble / Wikimedia Commons</li>
          <li>
            Geostationary orbit animation by Amitchell125, CC BY-SA 4.0, via Wikimedia Commons
          </li>
        </ul>
      </section>
    </section>
  );
}
