/**
 * Travelog MVP1 — Coordinate Normalization Tests (Phase 4 — Geoapify)
 */

import { describe, it, expect } from "vitest";
import { normalizeCoordinates, makeLocalityHash } from "../utils/geocoding.js";

describe("normalizeCoordinates", () => {
  it.each([
    [45.5621, 9.1742, 45.56, 9.17], // Milan area → ~1km buckets
    [45.5634, 9.1789, 45.56, 9.18], // close point but different hash bucket
    [0, 0, 0.0, 0.0], // equator
    [45.5, -9.25, 45.5, -9.25], // negative longitude
    [-33.87, 151.21, -33.87, 151.21], // Sydney
    [89.99, 179.99, 89.99, 179.99], // near pole — no rounding beyond existing decimals
  ])("should normalize lat=%f lon=%f to lat=%f lon=%f", (lat, lon, expectedLat, expectedLon) => {
    const result = normalizeCoordinates(lat, lon);
    expect(result.normalizedLatitude).toBe(expectedLat);
    expect(result.normalizedLongitude).toBe(expectedLon);
  });

  it("should produce consistent results for same input", () => {
    const r1 = normalizeCoordinates(45.56, 9.17);
    const r2 = normalizeCoordinates(45.56, 9.17);
    expect(r1.normalizedLatitude).toBe(r2.normalizedLatitude);
    expect(r1.normalizedLongitude).toBe(r2.normalizedLongitude);
  });

  it("should group nearby points within ~1km into same bucket", () => {
    // Points within ~100m should map to same locality hash (both lat and lon rounded)
    const a = normalizeCoordinates(45.5621, 9.1742);
    const b = normalizeCoordinates(45.5634, 9.1749);
    expect(a.normalizedLatitude).toBe(b.normalizedLatitude);
    expect(a.normalizedLongitude).toBe(b.normalizedLongitude);
  });
});

describe("makeLocalityHash", () => {
  it("should format as 'lat:lon'", () => {
    expect(makeLocalityHash(45.56, 9.17)).toBe("45.56:9.17");
  });

  it("should pad small values with zeros", () => {
    expect(makeLocalityHash(0.01, 0.12)).toBe("0.01:0.12");
  });

  it("should handle negative coordinates", () => {
    expect(makeLocalityHash(-33.87, -151.21)).toBe("-33.87:-151.21");
  });
});
