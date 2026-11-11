"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { utcDate, utcTime } from "@/lib/format";
import { loadObserver, type SavedObserver } from "@/lib/observer";

const Globe = dynamic(() => import("@/components/globe/Globe"), { ssr: false });

interface Props {
  noradId: number;
  name: string;
  tle1: string;
  tle2: string;
  referenceTime: string;
  apogeeKm: number;
}

export function OrbitView({ noradId, name, tle1, tle2, referenceTime, apogeeKm }: Props) {
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const [observer, setObserver] = useState<SavedObserver | null>(null);

  useEffect(() => {
    setObserver(loadObserver());
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPaused(true);
  }, []);

  // Pull the camera back far enough to keep the whole orbit in frame.
  const distance = Math.min(13, Math.max(3.4, (1 + apogeeKm / 6378) * 2.6));

  return (
    <div>
      <div className="history-hero__globe">
        <Globe
          satellites={[{ id: noradId, name, tle1, tle2 }]}
          selectedId={noradId}
          observer={observer ? { latitudeDeg: observer.latitudeDeg, longitudeDeg: observer.longitudeDeg, label: observer.name } : null}
          startTime={new Date(referenceTime)}
          speed={120}
          paused={paused}
          onClock={setClock}
          distance={distance}
          autoRotate={false}
          label={`Globe showing the current orbit of ${name}, drawn to scale.`}
        />
      </div>
      <div className="clock" style={{ justifyContent: "center", marginTop: "0.6rem" }}>
        <span className="clock__time">{clock ? `${utcDate(clock)} ${utcTime(clock, true)} UTC` : "—"}</span>
        <div className="segmented">
          <button type="button" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? "Play" : "Pause"}
          </button>
        </div>
        <span>120× · orbit to scale · in-browser visualisation</span>
      </div>
    </div>
  );
}
