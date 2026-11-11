"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PassTable } from "@/components/discover/PassTable";
import { ProvenanceLine } from "@/components/Provenance";
import { api, ApiError } from "@/lib/api/client";
import type { PassesResponse } from "@/lib/api/types";
import { utcDateTime } from "@/lib/format";
import { loadObserver, type SavedObserver } from "@/lib/observer";

type State =
  | { kind: "no-observer" }
  | { kind: "loading"; observer: SavedObserver }
  | { kind: "done"; observer: SavedObserver; data: PassesResponse }
  | { kind: "error"; observer: SavedObserver; message: string };

export function LocalPasses({ noradId, name }: { noradId: number; name: string }) {
  const [state, setState] = useState<State>({ kind: "no-observer" });

  useEffect(() => {
    const observer = loadObserver();
    if (!observer) return;
    const controller = new AbortController();
    setState({ kind: "loading", observer });
    api
      .passes(noradId, { lat: observer.latitudeDeg, lon: observer.longitudeDeg }, controller.signal)
      .then((data) => setState({ kind: "done", observer, data }))
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setState({ kind: "error", observer, message: e instanceof ApiError ? e.message : "The passes could not be computed." });
      });
    return () => controller.abort();
  }, [noradId]);

  if (state.kind === "no-observer") {
    return (
      <p>
        <Link href="/discover">Run a discovery for your city</Link> and this page will list {name}&apos;s predicted
        passes over it.
      </p>
    );
  }
  if (state.kind === "loading") {
    return <div className="skeleton" style={{ height: "8rem" }} role="status" aria-label={`Computing passes over ${state.observer.name}`} />;
  }
  if (state.kind === "error") {
    return (
      <div className="notice notice--error" role="alert">
        <strong>Passes unavailable.</strong> {state.message}
      </div>
    );
  }
  const { data, observer } = state;
  return (
    <div data-testid="local-passes">
      <p>
        Over <strong>{observer.name}</strong>, 24 hours from {utcDateTime(data.window_start)}, at least{" "}
        {data.min_elevation_deg}° above the horizon:
      </p>
      {data.passes.length > 0 ? (
        <PassTable passes={data.passes} timezone={observer.timezone} />
      ) : (
        <p className="notice notice--info">
          <strong>No qualifying pass.</strong> {data.not_computed_detail}
        </p>
      )}
      {data.provenance && (
        <div style={{ marginTop: "1rem" }}>
          <ProvenanceLine provenance={data.provenance} />
        </div>
      )}
      <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.8rem" }}>
        Predicted geometry only. A pass does not mean the spacecraft will be visible.
      </p>
    </div>
  );
}
