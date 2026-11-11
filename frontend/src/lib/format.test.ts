import { describe, expect, it } from "vitest";

import { coordinate, duration, elementAge, km, partialDate, utcDateTime, utcTime, yearsSince, zonedTime } from "./format";

describe("format", () => {
  it("always labels UTC and never shifts to the machine's zone", () => {
    expect(utcTime("2026-11-11T13:17:43Z")).toBe("13:17");
    expect(utcTime("2026-11-11T13:17:43Z", true)).toBe("13:17:43");
    expect(utcDateTime("2026-11-11T23:59:00Z")).toBe("11 Nov 2026, 23:59 UTC");
  });

  it("formats city-local time with its zone name and falls back to UTC", () => {
    expect(zonedTime("2026-11-11T13:17:43Z", "Asia/Kolkata")).toMatch(/^18:47/);
    expect(zonedTime("2026-11-11T13:17:43Z", undefined)).toBe("13:17 UTC");
    expect(zonedTime("2026-11-11T13:17:43Z", "Not/AZone")).toBe("13:17 UTC");
  });

  it("renders partial curated dates at their stated precision", () => {
    expect(partialDate("1964")).toBe("1964");
    expect(partialDate("1964-05")).toBe("May 1964");
    expect(partialDate("1958-03-17")).toBe("17 Mar 1958");
  });

  it("formats durations", () => {
    expect(duration(48)).toBe("48 s");
    expect(duration(672)).toBe("11 min 12 s");
    expect(duration(600)).toBe("10 min");
    expect(duration(86400)).toBe("24 h");
    expect(duration(5400)).toBe("1 h 30 min");
  });

  it("describes element age in both directions", () => {
    expect(elementAge(0.394)).toBe("9 h old");
    expect(elementAge(12.34)).toBe("12.3 d old");
    expect(elementAge(-4.2)).toBe("4.2 d ahead of window start");
  });

  it("counts whole years since launch", () => {
    expect(yearsSince("1958-03-17", new Date("2026-11-11T00:00:00Z"))).toBe(68);
    expect(yearsSince("1958-03-17", new Date("2026-03-16T00:00:00Z"))).toBe(67);
  });

  it("formats distances and coordinates", () => {
    expect(km(3819.4)).toBe("3,819 km");
    expect(km(null)).toBe("—");
    expect(coordinate(22.5726, 88.3639)).toBe("22.57° N, 88.36° E");
    expect(coordinate(-33.87, -70.67)).toBe("33.87° S, 70.67° W");
  });
});
