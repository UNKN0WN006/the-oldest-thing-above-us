import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-5 text-center">
      <h1 className="font-serif text-4xl font-light">Nothing here yet</h1>
      <p className="mt-3 text-muted">This page hasn’t been built. Head back and look up instead.</p>
      <Link href="/" className="btn-primary mt-8">Back to home</Link>
    </div>
  );
}
