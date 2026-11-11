import type {
  CityList,
  DiscoverRequest,
  DiscoverResponse,
  ErrorBody,
  GraveyardResponse,
  MethodologyDoc,
  PassesResponse,
  SatelliteDetail,
  SatelliteList,
  Status,
} from "./types";

/** An error the UI can show as-is. `kind` drives the wording of error states. */
export class ApiError extends Error {
  constructor(
    readonly kind: "network" | "not_found" | "invalid" | "server",
    message: string,
    readonly status?: number,
    readonly details?: ErrorBody["details"],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function baseUrl(): string {
  // Server components call the API directly; the browser goes through the Next.js rewrite.
  if (typeof window === "undefined") {
    return process.env.ABOVEUS_API_URL ?? "http://127.0.0.1:8000";
  }
  return "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/api/v1${path}`, {
      ...init,
      cache: "no-store",
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    });
  } catch (cause) {
    if ((cause as Error)?.name === "AbortError") throw cause;
    throw new ApiError("network", "The Above Us data service could not be reached.");
  }
  if (response.ok) return (await response.json()) as T;

  let body: ErrorBody | undefined;
  try {
    body = ((await response.json()) as { error?: ErrorBody }).error;
  } catch {
    body = undefined;
  }
  const kind = response.status === 404 ? "not_found" : response.status === 422 ? "invalid" : "server";
  throw new ApiError(
    kind,
    body?.message ?? `The data service answered with HTTP ${response.status}.`,
    response.status,
    body?.details,
  );
}

export const api = {
  status: (signal?: AbortSignal) => request<Status>("/status", { signal }),
  cities: (q?: string, signal?: AbortSignal) =>
    request<CityList>(`/cities${q ? `?q=${encodeURIComponent(q)}` : ""}`, { signal }),
  discover: (body: DiscoverRequest, signal?: AbortSignal) =>
    request<DiscoverResponse>("/discover", { method: "POST", body: JSON.stringify(body), signal }),
  satellites: (signal?: AbortSignal) => request<SatelliteList>("/satellites", { signal }),
  satellite: (noradId: number, signal?: AbortSignal) =>
    request<SatelliteDetail>(`/satellites/${noradId}`, { signal }),
  passes: (
    noradId: number,
    q: { lat: number; lon: number; start?: string; hours?: number; minElevationDeg?: number },
    signal?: AbortSignal,
  ) => {
    const p = new URLSearchParams({ lat: String(q.lat), lon: String(q.lon) });
    if (q.start) p.set("start", q.start);
    if (q.hours) p.set("hours", String(q.hours));
    if (q.minElevationDeg !== undefined) p.set("min_elevation_deg", String(q.minElevationDeg));
    return request<PassesResponse>(`/satellites/${noradId}/passes?${p}`, { signal });
  },
  graveyard: (signal?: AbortSignal) => request<GraveyardResponse>("/graveyard", { signal }),
  methodology: (signal?: AbortSignal) => request<MethodologyDoc>("/methodology", { signal }),
};
