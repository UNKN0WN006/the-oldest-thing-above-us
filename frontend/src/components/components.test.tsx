import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PassModel, Provenance } from "@/lib/api/types";

import { describePath, PassTable } from "./discover/PassTable";
import { ProvenanceLine } from "./Provenance";
import { SkyChart } from "./SkyChart";

const point = (time: string, az: number, el: number, compass: string) => ({ time, azimuth_deg: az, elevation_deg: el, compass });

const pass: PassModel = {
  start: point("2026-11-11T13:17:43Z", 315, 10, "NW"),
  culmination: point("2026-11-11T13:23:10Z", 20, 39.3, "NNE"),
  end: point("2026-11-11T13:28:55Z", 95, 10, "E"),
  duration_s: 672,
  starts_before_window: false,
  ends_after_window: false,
  range_km: 1034.2,
  sun_altitude_deg: -24.1,
  satellite_sunlit: false,
  illumination: "eclipsed",
  illumination_label: "Satellite in Earth's shadow",
  track: [
    { time: "2026-11-11T13:17:43Z", azimuth_deg: 315, elevation_deg: 10 },
    { time: "2026-11-11T13:23:10Z", azimuth_deg: 20, elevation_deg: 39.3 },
    { time: "2026-11-11T13:28:55Z", azimuth_deg: 95, elevation_deg: 10 },
  ],
};

describe("SkyChart", () => {
  it("describes the pass in words for assistive technology", () => {
    render(<SkyChart pass={pass} minElevationDeg={10} />);
    const chart = screen.getByRole("img");
    expect(chart).toHaveAccessibleName(/enters the NW at 13:17 UTC, peaks 39 degrees high in the NNE, and leaves in the E at 13:28 UTC/);
  });
});

describe("describePath", () => {
  it("names threshold crossings, not horizon crossings", () => {
    expect(describePath(pass)).toBe("Rises through the threshold in the NW, peaks 39° high toward the NNE, drops below it in the E.");
  });

  it("is explicit when the window cuts a pass", () => {
    expect(describePath({ ...pass, starts_before_window: true })).toMatch(/^Already up in the NW/);
    expect(describePath({ ...pass, ends_after_window: true })).toMatch(/still up in the E when the window ends\.$/);
    expect(describePath({ ...pass, starts_before_window: true, ends_after_window: true })).toMatch(/^Above the threshold for the whole window/);
  });
});

describe("PassTable", () => {
  it("shows local and UTC times and the lighting label", () => {
    render(<PassTable passes={[pass]} timezone="Asia/Kolkata" />);
    expect(screen.getByText(/18:47/)).toBeInTheDocument();
    expect(screen.getByText("13:17–13:28")).toBeInTheDocument();
    expect(screen.getByText("NW → NNE → E")).toBeInTheDocument();
    expect(screen.getByText("Satellite in Earth's shadow")).toBeInTheDocument();
  });
});

describe("ProvenanceLine", () => {
  const base: Provenance = {
    source: "snapshot",
    source_url: "https://celestrak.org/NORAD/elements/gp.php?CATNR=5&FORMAT=JSON",
    retrieved_at: "2026-11-11T11:15:27Z",
    element_epoch: "2026-11-11T01:47:55Z",
    element_age_days: 0.394,
    freshness: "fresh",
  };

  it("never presents archived data as live", () => {
    render(<ProvenanceLine provenance={base} />);
    expect(screen.getByText("Archived capture")).toBeInTheDocument();
    expect(screen.queryByText("Live fetch")).not.toBeInTheDocument();
    expect(screen.getByText(/Element epoch 11 Nov 2026, 01:47 UTC \(9 h old\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CelesTrak GP source" })).toHaveAttribute("href", base.source_url);
  });

  it("labels live, ageing data as both", () => {
    render(<ProvenanceLine provenance={{ ...base, source: "live", freshness: "aging", element_age_days: 12 }} />);
    expect(screen.getByText("Live fetch")).toBeInTheDocument();
    expect(screen.getByText("Ageing elements")).toBeInTheDocument();
  });
});
