import type { Metadata } from "next";
import { Suspense } from "react";

import { DiscoverClient } from "@/components/discover/DiscoverClient";

export const metadata: Metadata = { title: "Discover" };

export default function DiscoverPage() {
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Discovery</p>
        <h1>What is the oldest spacecraft passing over you?</h1>
        <p className="lede">
          Choose a place and a window. Above Us predicts every pass of its declared set of historic spacecraft, keeps
          the ones that clear your elevation threshold, and ranks them by launch date.
        </p>
      </header>
      <Suspense fallback={<div className="skeleton" style={{ height: "8rem" }} />}>
        <DiscoverClient />
      </Suspense>
    </div>
  );
}
