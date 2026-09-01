/**
 * Travelog MVP1 — Trip operations domain rules (Phase 6) — unit tests
 *
 * Pure rules of the manual operations: split (§13.3) and merge (§13.4).
 */

import { describe, it, expect } from "vitest";
import {
  isValidSplitDate,
  computeSplitIntervals,
  proposeSplitTripName,
  computeMergeInterval,
} from "../trip-operations.js";

describe("isValidSplitDate", () => {
  it("accepts a date strictly inside the trip (belongs to the second trip, §13.3)", () => {
    expect(isValidSplitDate("2025-08-10", "2025-08-17", "2025-08-14")).toBe(true);
    expect(isValidSplitDate("2025-08-10", "2025-08-17", "2025-08-11")).toBe(true);
    // the split date may be the trip end: second trip = single day
    expect(isValidSplitDate("2025-08-10", "2025-08-17", "2025-08-17")).toBe(true);
  });

  it("rejects dates outside the trip or equal to the start", () => {
    expect(isValidSplitDate("2025-08-10", "2025-08-17", "2025-08-10")).toBe(false);
    expect(isValidSplitDate("2025-08-10", "2025-08-17", "2025-08-09")).toBe(false);
    expect(isValidSplitDate("2025-08-10", "2025-08-17", "2025-08-18")).toBe(false);
  });
});

describe("computeSplitIntervals", () => {
  it("splits with the split date assigned to the second trip (§13.3)", () => {
    const [first, second] = computeSplitIntervals("2025-08-10", "2025-08-17", "2025-08-14");
    expect(first).toEqual({ startDate: "2025-08-10", endDate: "2025-08-13" });
    expect(second).toEqual({ startDate: "2025-08-14", endDate: "2025-08-17" });
  });

  it("handles a split on the last day", () => {
    const [first, second] = computeSplitIntervals("2025-08-10", "2025-08-11", "2025-08-11");
    expect(first).toEqual({ startDate: "2025-08-10", endDate: "2025-08-10" });
    expect(second).toEqual({ startDate: "2025-08-11", endDate: "2025-08-11" });
  });
});

describe("proposeSplitTripName", () => {
  it("derives the second trip name from the original", () => {
    expect(proposeSplitTripName("Vacanza in Toscana")).toBe("Vacanza in Toscana (2)");
  });
});

describe("computeMergeInterval", () => {
  it("spans the earliest start and the latest end (§13.4)", () => {
    const interval = computeMergeInterval([
      { startDate: "2025-08-12", endDate: "2025-08-13" },
      { startDate: "2025-08-10", endDate: "2025-08-11" },
    ]);
    expect(interval).toEqual({ startDate: "2025-08-10", endDate: "2025-08-13" });
  });

  it("handles three trips", () => {
    const interval = computeMergeInterval([
      { startDate: "2025-08-01", endDate: "2025-08-02" },
      { startDate: "2025-08-10", endDate: "2025-08-11" },
      { startDate: "2025-08-05", endDate: "2025-08-20" },
    ]);
    expect(interval).toEqual({ startDate: "2025-08-01", endDate: "2025-08-20" });
  });
});
