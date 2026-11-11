"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Something went wrong</p>
        <h1>This page could not be loaded.</h1>
        <div className="notice notice--error" role="alert" style={{ marginTop: "1.5rem" }}>
          <strong>The Above Us data service did not answer as expected.</strong>
          <p>{error.message || "No further detail is available."}</p>
          <p>No placeholder data is shown in its place.</p>
          <button type="button" className="btn btn--quiet" onClick={reset}>
            Try again
          </button>
        </div>
      </header>
    </div>
  );
}
