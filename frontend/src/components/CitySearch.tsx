"use client";

import { useEffect, useId, useRef, useState } from "react";

import { api } from "@/lib/api/client";
import type { City } from "@/lib/api/types";

interface Props {
  value: City | null;
  onChange: (city: City | null) => void;
  label?: string;
  placeholder?: string;
  hideLabel?: boolean;
}

/** Accessible combobox over the bundled gazetteer (WAI-ARIA 1.2 list autocomplete pattern). */
export function CitySearch({ value, onChange, label = "City", placeholder = "Search for a city", hideLabel }: Props) {
  const id = useId();
  const [text, setText] = useState(value?.name ?? "");
  const [options, setOptions] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(value?.name ?? "");
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const handle = setTimeout(() => {
      api
        .cities(text === value?.name ? "" : text, controller.signal)
        .then((r) => {
          setOptions(r.items.slice(0, 40));
          setActive(0);
          setError(null);
        })
        .catch((e: Error) => {
          if (e.name !== "AbortError") setError("The city list could not be loaded.");
        });
    }, 120);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [text, open, value]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (city: City) => {
    onChange(city);
    setText(city.name);
    setOpen(false);
  };

  return (
    <div className="field city-search__field" ref={boxRef}>
      <label htmlFor={id} className={hideLabel ? "visually-hidden" : undefined}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${id}-opt-${options[active].id}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && options[active]) {
            e.preventDefault();
            choose(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (
        <ul className="listbox" role="listbox" id={`${id}-list`} aria-label="Cities">
          {error && <li role="presentation">{error}</li>}
          {!error && options.length === 0 && (
            <li role="presentation">
              <span>No city in the bundled list matches. Use coordinates instead.</span>
            </li>
          )}
          {options.map((city, i) => (
            <li
              key={city.id}
              id={`${id}-opt-${city.id}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(city);
              }}
            >
              <span>{city.name}</span>
              <small>{[city.region, city.country].filter(Boolean).join(", ")}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
