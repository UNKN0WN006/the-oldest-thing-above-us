import { describe, expect, it } from "vitest";

import { utcWindowStart, validOptions } from "./windowStart";

describe("discovery input validation", () => {
  it("converts a UTC date/time into a timestamp", () => {
    expect(utcWindowStart("2026-11-11T14:30")).toBe("2026-11-11T14:30:00.000Z");
    expect(utcWindowStart("")).toBeNull();
  });

  it("rejects invalid months, impossible dates and malformed deep links", () => {
    expect(() => utcWindowStart("tomorrow")).toThrow("valid UTC");
    expect(() => utcWindowStart("2026-02-30T09:00")).toThrow("valid UTC");
    expect(() => utcWindowStart("2026-13-11T09:00")).toThrow("valid UTC");
  });

  it("rejects invalid limits", () => {
    expect(validOptions(24, 10)).toBe(true);
    expect(validOptions(-1, 10)).toBe(false);
    expect(validOptions(24, 100)).toBe(false);
    expect(validOptions(Number.NaN, 10)).toBe(false);
  });
});
