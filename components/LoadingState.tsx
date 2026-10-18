"use client";

import { useEffect, useState } from "react";

const messages = [
  "Preparing the demo archive…",
  "Checking sample orbital objects…",
  "Looking through sample space history…",
  "Preparing a sample result for this place…",
];

export default function LoadingState({ city }: { city: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => Math.min(s + 1, messages.length - 1));
    }, 1100);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-5 py-16 text-center">
      <div aria-hidden className="relative h-56 w-56">
        <div className="absolute inset-0 rounded-full border border-dashed border-line" />
        <img
          src="/images/earth-globe.webp"
          alt=""
          width={800}
          height={800}
          className="absolute left-1/2 top-1/2 w-44 -translate-x-1/2 -translate-y-1/2"
        />
        <div className="absolute inset-0 animate-orbit-fast">
          <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
        </div>
        <img
          src="/images/external/geostationary-orbit.gif"
          alt=""
          width={478}
          height={229}
          className="absolute left-1/2 top-1/2 z-10 w-56 -translate-x-1/2 -translate-y-1/2 opacity-60 mix-blend-screen"
        />
      </div>

      <h1 className="mt-10 font-serif text-4xl font-light">Searching the sky</h1>
      <p className="mt-2 text-muted">Preparing sample data for {city}</p>
      <p className="sr-only" role="status">{messages[step]}</p>

      <ul className="mt-8 w-full space-y-3 text-left text-sm">
        {messages.map((text, i) => (
          <li key={text} className={`flex items-center gap-3 ${i === step ? "text-ink" : "text-muted/50"}`}>
            <span className={`h-2 w-2 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
            {text}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-muted/70">
        Orbit animation by Amitchell125, CC BY-SA 4.0, via Wikimedia Commons.
      </p>
    </div>
  );
}
