"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBox() {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [locationState, setLocationState] = useState<"idle" | "loading" | "error">("idle");

  function search(place: string) {
    router.push("/result?city=" + encodeURIComponent(place));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (city.trim()) search(city.trim());
  }

  function useLocation() {
    if (!navigator.geolocation) {
      setLocationState("error");
      return;
    }

    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const query = new URLSearchParams({
          city: "your location",
          lat: String(coords.latitude),
          lon: String(coords.longitude),
        });
        router.push(`/result?${query.toString()}`);
      },
      () => setLocationState("error"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Enter your city (e.g. Kolkata)"
          aria-label="Your city"
          required
          className="min-h-14 flex-1 rounded-lg border border-line bg-panel px-5 text-base placeholder:text-muted focus:border-accent"
        />
        <button className="btn-primary">Look Above Me</button>
      </div>
      <button
        type="button"
        onClick={useLocation}
        disabled={locationState === "loading"}
        className="mt-4 py-2 text-sm text-muted underline underline-offset-4 hover:text-ink"
      >
        {locationState === "loading" ? "Requesting your location…" : "Use my location"}
      </button>
      {locationState === "error" && (
        <p className="mt-2 text-sm text-muted" role="alert">
          Location access was unavailable. Enter a city instead.
        </p>
      )}
    </form>
  );
}
