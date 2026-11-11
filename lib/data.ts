import { vanguard1 } from "./mockData";
import type { OrbitalObject } from "./types";

// Mock version. The wait is only there so you can see the loading screen.
export async function getOldestObject(city: string): Promise<OrbitalObject> {
  await new Promise((resolve) => setTimeout(resolve, 4500));
  return vanguard1;
}

export async function getObjectById(id: string): Promise<OrbitalObject | null> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return String(vanguard1.noradId) === id ? vanguard1 : null;
}

// Real version later. Keep the same name and return type and nothing else changes:
//
// export async function getOldestObject(city: string): Promise<OrbitalObject> {
//   const res = await fetch(`/api/oldest?city=${encodeURIComponent(city)}`);
//   if (!res.ok) throw new Error("Request failed");
//   return res.json();
// }
