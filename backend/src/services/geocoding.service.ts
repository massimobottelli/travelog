/**
 * Travelog MVP1 — Geocoding Service (Phase 4)
 *
 * Orchestrates reverse geocoding using local PostGIS data with a persistent cache.
 * Pipeline: normalize coords → check cache → spatial lookup if miss → persist in cache.
 */

import { pool as dbPool } from "../db/client.js";
import { eq } from "drizzle-orm";
import { datasetVersions as dvTable } from "../db/schema.js";
import type { AdminAreaRow } from "../repositories/admin-areas.repository.js";
import geocodingRepository from "../repositories/geocoding.repository.js";
import { normalizeCoordinates } from "../utils/geocoding.js";

export interface ReverseGeocodeResult {
  adminAreaId: number | null;
  countryCode: string | null;
  name: string | null;
  adminLevel: number | null;
  hierarchy: Array<{ name: string; adminLevel: number; countryCode: string }>;
}

const DATASET_NAME = "osm_boundaries";
const DEFAULT_GEO_VERSION = "1.0.0";

class GeocodingService {
  /**
   * Get or set the current dataset version recorded in the database.
   * If no version is recorded yet, inserts the default version.
   */
  async getOrCreateGeoVersion(): Promise<string> {
    const existing = await geocodingRepository.getLatestDatasetVersion(DATASET_NAME);
    if (existing && existing.version) return existing.version;

    // No version found — insert the default placeholder
    try {
      await geocodingRepository.recordDatasetVersion({
        name: DATASET_NAME,
        version: DEFAULT_GEO_VERSION,
        description: "Initial OSM boundaries import",
        rowCount: 0,
      });
    } catch { /* ignore race condition on concurrent startup */ }
    return DEFAULT_GEO_VERSION;
  }

  /**
   * Perform reverse geocoding for a single GPS point.
   * Uses normalized coordinates (4 decimals) as cache key.
   * Returns the administrative area info plus its full hierarchy.
   */
  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult> {
    const geoVersion = await this.getOrCreateGeoVersion();
    const { normalizedLatitude, normalizedLongitude } = normalizeCoordinates(latitude, longitude);

    // Check cache first
    const cached = await geocodingRepository.getGeocodeCacheEntry(
      normalizedLatitude,
      normalizedLongitude,
    );
    if (cached && cached.adminAreaId !== null) {
      const hierarchy = await geocodingRepository.resolveHierarchy(cached.adminAreaId);
      return {
        adminAreaId: cached.adminAreaId,
        countryCode: cached.countryCode,
        name: cached.name,
        adminLevel: cached.adminLevel,
        hierarchy,
      };
    }

    // Cache miss — spatial query via PostGIS
    const adminArea = await geocodingRepository.findAdminAreaByPoint(
      normalizedLatitude,
      normalizedLongitude,
    );

    if (!adminArea) {
      // Point not inside any known boundary — return null result
      await geocodingRepository.upsertGeocodeCache({
        normalizedLatitude,
        normalizedLongitude,
        adminAreaId: null,
        countryCode: null,
        adminLevel: null,
        name: null,
        geoVersion,
      });
      return {
        adminAreaId: null,
        countryCode: null,
        name: null,
        adminLevel: null,
        hierarchy: [],
      };
    }

    // Resolve the full hierarchy
    const hierarchy = await geocodingRepository.resolveHierarchy(adminArea.id);

    // Persist to cache
    await geocodingRepository.upsertGeocodeCache({
      normalizedLatitude,
      normalizedLongitude,
      adminAreaId: adminArea.id,
      countryCode: adminArea.countryCode,
      adminLevel: adminArea.adminLevel,
      name: adminArea.name,
      geoVersion,
    });

    return {
      adminAreaId: adminArea.id,
      countryCode: adminArea.countryCode,
      name: adminArea.name,
      adminLevel: adminArea.adminLevel,
      hierarchy,
    };
  }

  /**
   * Import a geographic dataset from GeoJSON files stored under data/geodata/.
   * Currently expects a file named `boundaries.geojson` at that path.
   */
  async importGeodata(): Promise<{ datasetName: string; version: string; importedRows: number }> {
    throw new Error("Not implemented — use scripts/import-geodata.mjs instead");
  }
}

export default new GeocodingService();
