"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { CitySearch } from "@/components/CitySearch";
import { api, ApiError } from "@/lib/api/client";
import type { City, DiscoverResponse } from "@/lib/api/types";
import { saveObserver } from "@/lib/observer";
import { utcWindowStart, validOptions } from "@/lib/windowStart";

import { Results } from "./Results";

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; data: DiscoverResponse; timezone?: string }
  | { kind: "error"; error: ApiError };

const HOURS = [6, 12, 24, 48, 72];
const ELEVATIONS = [
  { value: 10, label: "10° — clear of most rooftops" },
  { value: 20, label: "20°" },
  { value: 30, label: "30° — well up" },
  { value: 45, label: "45° — high overhead" },
];

export function DiscoverClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [city, setCity] = useState<City | null>(null);
  const [useCoords, setUseCoords] = useState(params.has("lat"));
  const [lat, setLat] = useState(params.get("lat") ?? "");
  const [lon, setLon] = useState(params.get("lon") ?? "");
  const [hours, setHours] = useState(Number(params.get("hours")) || 24);
  const [minEl, setMinEl] = useState(Number(params.get("el")) || 10);
  const [start, setStart] = useState(params.get("start") ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const inflight = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const run = useCallback(
    async (observer: { lat: number; lon: number; name?: string; timezone?: string; cityId?: string }, opts: { hours: number; minEl: number; start: string }) => {
      inflight.current?.abort();
      let utcStart: string | null;
      try {
        if (!validOptions(opts.hours, opts.minEl)) throw new Error("Choose a valid observation window and elevation.");
        utcStart = utcWindowStart(opts.start);
      } catch (error) {
        setPhase({ kind: "error", error: new ApiError("invalid", (error as Error).message) });
        return;
      }
      const controller = new AbortController();
      inflight.current = controller;
      setPhase({ kind: "loading" });
      const q = new URLSearchParams();
      if (observer.cityId) q.set("city", observer.cityId);
      else {
        q.set("lat", String(observer.lat));
        q.set("lon", String(observer.lon));
      }
      if (opts.hours !== 24) q.set("hours", String(opts.hours));
      if (opts.minEl !== 10) q.set("el", String(opts.minEl));
      if (opts.start) q.set("start", opts.start);
      router.replace(`${pathname}?${q}`, { scroll: false });
      try {
        const data = await api.discover(
          {
            observer: { latitude_deg: observer.lat, longitude_deg: observer.lon, elevation_m: 0, place_name: observer.name ?? null },
            hours: opts.hours,
            min_elevation_deg: opts.minEl,
            start: utcStart,
          },
          controller.signal,
        );
        saveObserver({
          name: observer.name ?? `${observer.lat.toFixed(2)}, ${observer.lon.toFixed(2)}`,
          latitudeDeg: observer.lat,
          longitudeDeg: observer.lon,
          timezone: observer.timezone,
        });
        setPhase({ kind: "done", data, timezone: observer.timezone });
        requestAnimationFrame(() => resultRef.current?.focus({ preventScroll: true }));
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setPhase({ kind: "error", error: e instanceof ApiError ? e : new ApiError("server", "Something went wrong.") });
      }
    },
    [pathname, router],
  );

  // Deep links: /discover?city=kolkata or ?lat=..&lon=..
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const opts = { hours: Number(params.get("hours")) || 24, minEl: Number(params.get("el")) || 10, start: params.get("start") ?? "" };
    const cityId = params.get("city");
    if (cityId) {
      api
        .cities()
        .then((list) => {
          const found = list.items.find((c) => c.id === cityId);
          if (!found) {
            setFormError(`"${cityId}" is not in the bundled city list. Choose a city or enter coordinates.`);
            return;
          }
          setCity(found);
          void run({ lat: found.latitude_deg, lon: found.longitude_deg, name: found.name, timezone: found.timezone, cityId: found.id }, opts);
        })
        .catch((e) => setPhase({ kind: "error", error: e instanceof ApiError ? e : new ApiError("network", "The city list could not be loaded.") }));
    } else if (params.has("lat") && params.has("lon")) {
      const la = Number(params.get("lat"));
      const lo = Number(params.get("lon"));
      if (Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) {
        void run({ lat: la, lon: lo }, opts);
      } else {
        setFormError("This link has invalid coordinates. Enter a location to continue.");
      }
    }
  }, [params, run]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const opts = { hours, minEl, start };
    if (useCoords) {
      const la = Number(lat);
      const lo = Number(lon);
      if (lat.trim() === "" || lon.trim() === "" || !Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
        setFormError("Enter a latitude between −90 and 90 and a longitude between −180 and 180 (east positive).");
        return;
      }
      void run({ lat: la, lon: lo }, opts);
    } else if (city) {
      void run({ lat: city.latitude_deg, lon: city.longitude_deg, name: city.name, timezone: city.timezone, cityId: city.id }, opts);
    } else {
      setFormError("Choose a city from the list, or switch to coordinates.");
    }
  };

  return (
    <>
      <form className="panel" onSubmit={submit} aria-label="Discovery settings" noValidate>
        <div className="query">
          {useCoords ? (
            <div className="field">
              <span className="label" id="coords-label">
                Coordinates (decimal degrees)
              </span>
              <div className="coords" role="group" aria-labelledby="coords-label">
                <input className="input" inputMode="decimal" aria-label="Latitude, north positive" placeholder="Latitude e.g. 22.57" value={lat} onChange={(e) => setLat(e.target.value)} />
                <input className="input" inputMode="decimal" aria-label="Longitude, east positive" placeholder="Longitude e.g. 88.36" value={lon} onChange={(e) => setLon(e.target.value)} />
              </div>
            </div>
          ) : (
            <CitySearch value={city} onChange={setCity} label="City" placeholder="Search for a city" />
          )}
          <div className="field">
            <label htmlFor="start">Window starts (UTC)</label>
            <input id="start" className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} aria-describedby="start-hint" />
          </div>
          <div className="field">
            <label htmlFor="hours">Window length</label>
            <select id="hours" className="select" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h} hours
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="minel">Minimum elevation</label>
            <select id="minel" className="select" value={minEl} onChange={(e) => setMinEl(Number(e.target.value))}>
              {ELEVATIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn--primary" disabled={phase.kind === "loading"}>
            {phase.kind === "loading" ? "Computing…" : "Find the oldest"}
          </button>
        </div>
        <p className="field__hint" id="start-hint" style={{ margin: "0.9rem 0 0" }}>
          Leave the start empty to begin from the data service&apos;s reference time (now, for live data).{" "}
          <button type="button" className="query__toggle" onClick={() => setUseCoords((v) => !v)}>
            {useCoords ? "Search by city instead" : "Enter exact coordinates instead"}
          </button>
        </p>
        {formError && (
          <p className="notice notice--error" role="alert" style={{ marginTop: "1rem" }}>
            {formError}
          </p>
        )}
      </form>

      <div ref={resultRef} tabIndex={-1} style={{ marginTop: "2rem", outline: "none" }} aria-live="polite" aria-busy={phase.kind === "loading"}>
        {phase.kind === "idle" && (
          <p className="muted" data-testid="idle">
            Choose a place to begin. Nothing is shown until a real prediction has been computed.
          </p>
        )}
        {phase.kind === "loading" && (
          <div className="loading-block" role="status" data-testid="loading">
            <p>Propagating every spacecraft in the candidate set across your window. This takes a few seconds.</p>
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        )}
        {phase.kind === "error" && (
          <div className="notice notice--error" role="alert" data-testid="error">
            <strong>{phase.error.kind === "network" ? "The data service is not reachable." : "The prediction could not be computed."}</strong>
            <p>{phase.error.message}</p>
            {phase.error.details && (
              <ul>
                {phase.error.details.map((d, i) => (
                  <li key={i}>
                    {String(d.field)}: {String(d.message)}
                  </li>
                ))}
              </ul>
            )}
            <p>No placeholder results are shown in its place.</p>
            <button type="button" className="btn btn--quiet" onClick={(e) => submit(e)}>
              Try again
            </button>
          </div>
        )}
        {phase.kind === "done" && <Results data={phase.data} timezone={phase.timezone} />}
      </div>
    </>
  );
}
