export type ObjectStatus = "Active" | "Inactive";

export type OrbitalObject = {
  name: string;
  noradId: number;
  launchDate: string; // "1958-03-17"
  launchYear: number;
  age: number;
  country: string;
  status: ObjectStatus;
  purpose: string;
  nextPass: string; // time of the highest point
  passStart: string;
  passEnd: string;
  maxElevation: number; // degrees above the horizon
  historicalFact: string;
  story: string;
  mission: string;
  timeline: { year: string; event: string }[];
};
