import type { OrbitalObject } from "./types";

// Edit this object to change what the result page shows.
export const vanguard1: OrbitalObject = {
  name: "Vanguard 1",
  noradId: 5,
  launchDate: "1958-03-17",
  launchYear: 1958,
  age: 68,
  country: "USA",
  status: "Inactive",
  purpose: "Earth Science",
  nextPass: "8:42 PM",
  passStart: "8:38 PM",
  passEnd: "8:47 PM",
  maxElevation: 31,
  historicalFact: "When this object launched, no human had yet travelled into space.",
  story:
    "Vanguard 1 is represented here as a small archive entry for exploring the idea of long-lived objects in orbit. This story is demo content until it is connected to a verified historical source.",
  mission:
    "The original mission context and object history are placeholders for the future archive integration. No live orbital or visibility calculation is included in this demo.",
  timeline: [
    { year: "1958", event: "Launch date shown in this demo record." },
    { year: "Today", event: "The demo record remains available to explore." },
  ],
};
