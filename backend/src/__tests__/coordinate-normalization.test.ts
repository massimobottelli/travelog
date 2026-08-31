/**
 * Travelog MVP1 — Coordinate Normalization Tests (Phase 4)
 */

import { describe, it, expect } from "vitest";
import { normalizeCoordinates } from "../utils/geocoding.js";

describe("normalizeCoordinates", () => {
  it.each([
    [45.4642, 9.1897, 45.4642, 9.1897],           // exact match
    [45.46421, 9.18971, 45.4642, 9.1897],          // slight offset → same bucket
    [45.46425, 9.18975, 45.4643, 9.1898],          // rounds up
    [0, 0, 0, 0],                                  // equator
    [45.5, -9.25, 45.5, -9.25],                    // negative longitude
    [-33.8688, 151.2093, -33.8688, 151.2093],      // Sydney
    [89.9999, 179.9999, 89.9999, 179.9999],  // edge rounding stays as-is
  ])(
    "should normalize lat=%f lon=%f to lat=%f lon=%f",
    (lat, lon, expectedLat, expectedLon) => {
      const result = normalizeCoordinates(lat, lon);
      expect(result.normalizedLatitude).toBe(expectedLat);
      expect(result.normalizedLongitude).toBe(expectedLon);
    },
  );

  it("should produce consistent results for same input", () => {
    const r1 = normalizeCoordinates(45.4642, 9.1897);
    const r2 = normalizeCoordinates(45.4642, 9.1897);
    expect(r1.normalizedLatitude).toBe(r2.normalizedLatitude);
    expect(r1.normalizedLongitude).toBe(r2.normalizedLongitude);
  });

  it("should round different coordinates to different buckets when > 0.0001 apart", () => {
    const a = normalizeCoordinates(45.4642, 9.1897);
    const b = normalizeCoordinates(45.4645, 9.1897);
    expect(a.normalizedLatitude).not.toBe(b.normalizedLatitude);
  });
});
