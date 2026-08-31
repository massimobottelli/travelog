/**
 * Travelog MVP1 — Geocoding Integration Tests (Phase 4)
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { pool as pgPool } from "../db/client.js";
import geocodingRepo from "../repositories/geocoding.repository.js";

describe("Geocoding Repository", () => {
  beforeEach(async () => {
    // Clean up any existing test data first
    await pgPool.query("DELETE FROM geocoding_cache");
    await pgPool.query(`DELETE FROM administrative_areas WHERE name = 'Test Area' AND dataset_source = 'test'`);
  });

  afterAll(async () => {
    await pgPool.query(`DELETE FROM administrative_areas WHERE dataset_source = 'test'`);
  });

  it.each([
    [45.4642, 9.1897],  // Milan area
    [41.9028, 12.4964], // Rome area
  ])("should return null when no admin areas exist", async (lat: number, lon: number) => {
    const result = await geocodingRepo.findAdminAreaByPoint(lat, lon);
    expect(result).toBeNull();
  });

  it("should insert and retrieve a cached geocode result", async () => {
    // Insert a test admin area with known geometry covering Milan
    const milanWkt = "POLYGON((9.0 45.3, 9.3 45.3, 9.3 45.5, 9.0 45.5, 9.0 45.3))";
    const { rows: inserted } = await pgPool.query(
      `INSERT INTO administrative_areas (dataset_source, country_code, admin_level, name, geometry, geom, parent_id, geo_version) 
       VALUES ('test', 'IT', 4, 'Test Area', $1, ST_GeomFromText($1, 4326), NULL, 'test-v1') RETURNING id`,
      [milanWkt],
    );
    const areaId = Number(inserted[0].id);

    try {
      // Spatial lookup should find the area
      const result = await geocodingRepo.findAdminAreaByPoint(45.4642, 9.1897);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.name).toBe("Test Area");
        expect(result.countryCode).toBe("IT");
        expect(result.adminLevel).toBe(4);
      }

      // Cache should be empty initially
      const cacheBefore = await geocodingRepo.getGeocodeCacheEntry(45.4642, 9.1897);
      expect(cacheBefore).toBeNull();

      // Upsert cache entry manually
      await geocodingRepo.upsertGeocodeCache({
        normalizedLatitude: 45.4642,
        normalizedLongitude: 9.1897,
        adminAreaId: areaId,
        countryCode: "IT",
        adminLevel: 4,
        name: "Test Area",
        geoVersion: "test-v1",
      });

      // Should now retrieve from cache
      const cacheAfter = await geocodingRepo.getGeocodeCacheEntry(45.4642, 9.1897);
      expect(cacheAfter).not.toBeNull();
      if (cacheAfter) {
        expect(cacheAfter.adminAreaId).toBe(areaId);
        expect(cacheAfter.name).toBe("Test Area");
      }

      // Second call to same coordinates should still return cache
      const cacheAgain = await geocodingRepo.getGeocodeCacheEntry(45.4642, 9.1897);
      expect(cacheAgain?.adminAreaId).toBe(areaId);
    } finally {
      // Cleanup
      await pgPool.query(`DELETE FROM geocoding_cache WHERE normalized_latitude = 45.4642 AND normalized_longitude = 9.1897`);
      await pgPool.query(`DELETE FROM administrative_areas WHERE id = $1`, [areaId]);
    }
  });

  it("should handle null result for point outside all areas", async () => {
    // Point in ocean far from any land boundary
    const cacheResult = await geocodingRepo.upsertGeocodeCache({
      normalizedLatitude: -55.0,
      normalizedLongitude: -70.0,
      adminAreaId: null,
      countryCode: null,
      adminLevel: null,
      name: null,
      geoVersion: "test-v1",
    });

    // Should not throw and return nothing
    const lookup = await geocodingRepo.getGeocodeCacheEntry(-55.0, -70.0);
    expect(lookup).toHaveProperty("adminAreaId", null);
  });
});
