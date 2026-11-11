"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CitySearch } from "@/components/CitySearch";
import type { GlobeSatellite } from "@/components/globe/Globe";
import { api, ApiError } from "@/lib/api/client";
import type { City, SatelliteListItem } from "@/lib/api/types";
import { utcDate, utcTime } from "@/lib/format";
import { satrecFromTle, subPoint } from "@/lib/orbit";
import { useStatus } from "@/lib/useStatus";

const Globe = dynamic(() => import("@/components/globe/Globe"), { ssr: false });

const SPEEDS = [
  { value: 1, label: "1×" },
  { value: 60, label: "60×" },
  { value: 600, label: "600×" },
];

export function HomeHero() {
  const router = useRouter();
  const { status } = useStatus();
  const [items, setItems] = useState<SatelliteListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [city, setCity] = useState<City | null>(null);
  const [speed, setSpeed] = useState(60);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSpeed(1);
      setPaused(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api
      .satellites(controller.signal)
      .then((list) => {
        // The hero shows spacecraft that have a curated story and current elements.
        const featured = list.items.filter((i) => i.satellite.has_story && i.tle_line1 && i.tle_line2);
        setItems(featured);
        setStartTime(new Date(list.reference_time));
        setSelectedId((current) => current ?? featured[0]?.satellite.norad_id ?? null);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setLoadError(e instanceof ApiError ? e.message : "The spacecraft list could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  const globeSatellites = useMemo<GlobeSatellite[]>(
    () =>
      (items ?? []).map((i) => ({
        id: i.satellite.norad_id,
        name: i.satellite.display_name,
        tle1: i.tle_line1!,
        tle2: i.tle_line2!,
      })),
    [items],
  );

  const selected = items?.find((i) => i.satellite.norad_id === selectedId) ?? null;

  const overNow = useMemo(() => {
    if (!selected?.tle_line1 || !selected.tle_line2 || !clock) return null;
    return subPoint(satrecFromTle(selected.tle_line1, selected.tle_line2), clock);
  }, [selected, clock]);

  const select = useCallback((id: number) => {
    setSelectedId(id);
    railRef.current?.querySelector<HTMLElement>(`[data-id="${id}"]`)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, []);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(city ? `/discover?city=${city.id}` : "/discover");
  };

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__stage">
        {startTime && globeSatellites.length > 0 && (
          <Globe
            satellites={globeSatellites}
            selectedId={selectedId}
            onSelect={select}
            observer={city ? { latitudeDeg: city.latitude_deg, longitudeDeg: city.longitude_deg, label: city.name } : null}
            startTime={startTime}
            speed={speed}
            paused={paused}
            onClock={setClock}
            distance={4.7}
            label={`Interactive globe showing the orbits of ${globeSatellites.length} historic spacecraft. Use the list below the globe to select one.`}
          />
        )}
      </div>
      <div className="hero__veil" aria-hidden="true" />

      <div className="hero__content">
        <div className="hero__copy">
          <p className="eyebrow">Space data for everyone · Team Cosmic Compass</p>
          <h1 id="hero-title">
            The oldest thing <em>above you.</em>
          </h1>
          <p className="lede">
            Machines launched before most of us were born are still circling the planet. Pick a city and find the
            earliest-launched spacecraft predicted to pass over it — then read the history it carries.
          </p>
          <form className="city-search" onSubmit={go} aria-label="Start a discovery">
            <CitySearch value={city} onChange={setCity} hideLabel label="Your city" placeholder="Your city — try Kolkata" />
            <button type="submit" className="btn btn--primary">
              Find what passes over
            </button>
          </form>
          <p className="hero__fineprint">
            A predicted pass is a statement about geometry. Most of these spacecraft are far too faint to see without
            a telescope.
          </p>
        </div>

        <div className="hero__side">
          {selected && (
            <article className="sat-card" aria-live="polite" data-testid="sat-card">
              <div className="sat-card__year">{selected.satellite.launch_year}</div>
              <h2>{selected.satellite.display_name}</h2>
              <p>{selected.satellite.tagline}</p>
              <div className="sat-card__live">
                {overNow ? (
                  <>
                    {Math.abs(overNow.latitudeDeg).toFixed(1)}°{overNow.latitudeDeg >= 0 ? "N" : "S"}{" "}
                    {Math.abs(overNow.longitudeDeg).toFixed(1)}°{overNow.longitudeDeg >= 0 ? "E" : "W"} ·{" "}
                    {Math.round(overNow.heightKm).toLocaleString("en-GB")} km up
                    <br />
                    in-browser orbit view, {selected.satellite.fate_label.toLowerCase()}
                  </>
                ) : (
                  "Computing position…"
                )}
              </div>
              <Link className="btn btn--quiet" href={`/satellites/${selected.satellite.norad_id}`}>
                Read its history →
              </Link>
            </article>
          )}
        </div>

        <div className="hero__dock">
          {loadError && (
            <div className="notice notice--error" role="alert">
              <strong>Orbits unavailable.</strong> {loadError} Nothing is being simulated in their place.
            </div>
          )}
          {!items && !loadError && <div className="skeleton" style={{ height: "3.4rem" }} aria-label="Loading spacecraft" />}

          {items && items.length > 0 && (
            <div className="rail" ref={railRef} role="group" aria-label="Choose a spacecraft, ordered by launch date">
              {items.map((i) => (
                <button
                  key={i.satellite.norad_id}
                  type="button"
                  data-id={i.satellite.norad_id}
                  aria-pressed={i.satellite.norad_id === selectedId}
                  onClick={() => select(i.satellite.norad_id)}
                >
                  <span className="rail__year">{i.satellite.launch_year}</span>
                  <span className="rail__name">{i.satellite.display_name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="clock">
            <span className={`pill ${status?.data_mode === "live" ? "pill--live" : "pill--archived"}`}>
              {status ? (status.data_mode === "live" ? "Live elements" : status.data_mode === "mixed" ? "Mixed sources" : "Archived elements") : "Checking data"}
            </span>
            <span className="clock__time" aria-label="Simulation time">
              {clock ? `${utcDate(clock)} ${utcTime(clock, true)} UTC` : "—"}
            </span>
            <div className="segmented" role="group" aria-label="Animation speed">
              <button type="button" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
                {paused ? "Play" : "Pause"}
              </button>
              {SPEEDS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={!paused && speed === s.value}
                  aria-label={`Speed ${s.value} times real time`}
                  onClick={() => {
                    setSpeed(s.value);
                    setPaused(false);
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <span>Orbits to scale · drag to turn, scroll to zoom</span>
          </div>
        </div>
      </div>
    </section>
  );
}
