import OrbitBackground from "@/components/OrbitBackground";
import SearchBox from "@/components/SearchBox";

export default function HomePage() {
  return (
    <section className="relative isolate overflow-hidden">
      <OrbitBackground />
      <div className="relative z-10 mx-auto flex min-h-[75dvh] max-w-5xl flex-col justify-center px-5 py-16">
        <h1 className="max-w-3xl font-serif text-5xl font-light leading-[1.05] sm:text-7xl">
          What is the oldest thing above you?
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Thousands of human-made objects still circle Earth. Enter a city to
          explore a sample record from our future space archive.
        </p>
        <div className="mt-10 max-w-2xl">
          <SearchBox />
        </div>
      </div>
    </section>
  );
}
