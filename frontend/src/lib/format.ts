/** Formatting helpers. Times are always labelled with their zone; nothing is shown zone-less. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function utcTime(iso: string | Date, withSeconds = false): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${withSeconds ? `:${pad(d.getUTCSeconds())}` : ""}`;
}

export function utcDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function utcDateTime(iso: string | Date): string {
  return `${utcDate(iso)}, ${utcTime(iso)} UTC`;
}

/** Wall-clock time in an IANA zone, e.g. "18:47 IST" (falls back to UTC if the zone is unknown). */
export function zonedTime(iso: string, timeZone: string | undefined, withDay = false): string {
  if (!timeZone) return `${utcTime(iso)} UTC`;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
      ...(withDay ? { weekday: "short", day: "numeric", month: "short" } : {}),
    }).format(new Date(iso));
    return parts;
  } catch {
    return `${utcTime(iso)} UTC`;
  }
}

/** A partial ISO date from the curated records: "1964", "1964-05" or "1964-05-12". */
export function partialDate(value: string): string {
  const [y, m, d] = value.split("-");
  if (!m) return y ?? value;
  const month = MONTHS[Number(m) - 1] ?? m;
  return d ? `${Number(d)} ${month} ${y}` : `${month} ${y}`;
}

export function duration(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s ? `${m} min ${s} s` : `${m} min`;
  }
  return `${Math.round(seconds)} s`;
}

export function elementAge(days: number): string {
  const a = Math.abs(days);
  const text = a < 1 ? `${Math.max(1, Math.round(a * 24))} h` : `${a.toFixed(1)} d`;
  return days < 0 ? `${text} ahead of window start` : `${text} old`;
}

export function yearsSince(launchDate: string, now: Date = new Date()): number {
  const launch = new Date(`${launchDate}T00:00:00Z`);
  return Math.floor((now.getTime() - launch.getTime()) / (365.25 * 86_400_000));
}

export function km(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value).toLocaleString("en-GB")} km`;
}

export function degrees(value: number, digits = 0): string {
  return `${value.toFixed(digits)}°`;
}

export function coordinate(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
}
