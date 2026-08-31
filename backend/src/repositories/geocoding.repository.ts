/**
 * Travelog MVP1 — Geocoding Repository (Phase 4 — Geoapify)
 *
 * CRUD for localities and geocoding cache using native SQL.
 * No longer depends on administrative_areas or PostGIS spatial functions.
 */

import { pool as pgPool } from "../db/client.js";

export interface LocalityRow {
  id: number;
  localityHash: string;
  countryCode: string;
  name: string;
  adminLevel: number;
  street: string | null;
  county: string | null;
  region: string | null;
  country: string | null;
}

/**
 * Upsert a locality. Returns the row (inserted or existing).
 */
export async function upsertLocality(params: {
  localityHash: string;
  countryCode: string;
  name: string;
  adminLevel: number;
  street?: string | null;
  county?: string | null;
  region?: string | null;
  country?: string | null;
}): Promise<LocalityRow> {
  const result = await pgPool.query(
    `INSERT INTO localities (locality_hash, country_code, name, admin_level, street, county, region, country)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (locality_hash) DO UPDATE SET
       name             = EXCLUDED.name,
       admin_level      = EXCLUDED.admin_level,
       street           = COALESCE(EXCLUDED.street, localities.street),
       county           = COALESCE(EXCLUDED.county, localities.county),
       region           = COALESCE(EXCLUDED.region, localities.region),
       country          = COALESCE(EXCLUDED.country, localities.country)
     RETURNING id, locality_hash, country_code, name, admin_level, street, county, region, country`,
    [
      params.localityHash,
      params.countryCode,
      params.name,
      params.adminLevel,
      params.street ?? null,
      params.county ?? null,
      params.region ?? null,
      params.country ?? null,
    ],
  );
  const r = result.rows[0];
  return {
    id: Number(r.id),
    localityHash: r.locality_hash,
    countryCode: r.country_code,
    name: r.name,
    adminLevel: r.admin_level,
    street: r.street,
    county: r.county,
    region: r.region,
    country: r.country,
  };
}

/**
 * Look up a locality by hash.
 */
export async function getLocalityByHash(localityHash: string): Promise<LocalityRow | null> {
  const result = await pgPool.query(
    `SELECT id, locality_hash, country_code, name, admin_level, street, county, region, country
     FROM localities WHERE locality_hash = $1`,
    [localityHash],
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    id: Number(r.id),
    localityHash: r.locality_hash,
    countryCode: r.country_code,
    name: r.name,
    adminLevel: r.admin_level,
    street: r.street,
    county: r.county,
    region: r.region,
    country: r.country,
  };
}

/**
 * Search localities by name substring (case-insensitive).
 */
export async function searchLocalities(q: string, limit: number): Promise<Array<{
  id: number;
  countryCode: string;
  name: string;
  adminLevel: number;
  region?: string | null;
  county?: string | null;
}>> {
  const pattern = `%${q}%`;
  const result = await pgPool.query(
    `SELECT id, country_code, name, admin_level, region, county
     FROM localities
     WHERE name ILIKE $1
        OR region ILIKE $1
        OR county ILIKE $1
     ORDER BY name
     LIMIT $2`,
    [pattern, limit],
  );
  return result.rows.map((r) => ({
    id: Number(r.id),
    countryCode: r.country_code,
    name: r.name,
    adminLevel: r.admin_level,
    region: r.region,
    county: r.county,
  }));
}

/**
 * Get cached geocode entry for exact original coordinates.
 */
export async function getGeocodeCacheEntry(
  latitude: number,
  longitude: number,
): Promise<{
  localityId: number | null;
  countryCode: string | null;
  name: string | null;
  adminLevel: number | null;
} | null> {
  const result = await pgPool.query(
    `SELECT locality_id, country_code, name, admin_level
     FROM geocoding_cache
     WHERE original_latitude = $1 AND original_longitude = $2`,
    [latitude, longitude],
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    localityId: r.locality_id ? Number(r.locality_id) : null,
    countryCode: r.country_code,
    name: r.name,
    adminLevel: r.admin_level,
  };
}

/**
 * Upsert a geocoding cache entry.
 */
export async function upsertGeocodeCache(params: {
  latitude: number;
  longitude: number;
  localityHash: string;
  localityId: number | null;
  countryCode: string | null;
  name: string | null;
  adminLevel: number | null;
}): Promise<void> {
  await pgPool.query(
    `INSERT INTO geocoding_cache (original_latitude, original_longitude, locality_hash, locality_id, country_code, name, admin_level, geo_applied)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     ON CONFLICT (original_latitude, original_longitude) DO UPDATE SET
       locality_hash   = EXCLUDED.locality_hash,
       locality_id     = EXCLUDED.locality_id,
       country_code    = EXCLUDED.country_code,
       name            = EXCLUDED.name,
       admin_level     = EXCLUDED.admin_level,
       geo_applied     = EXCLUDED.geo_applied`,
    [
      params.latitude,
      params.longitude,
      params.localityHash,
      params.localityId,
      params.countryCode,
      params.name,
      params.adminLevel,
    ],
  );
}

export default {
  upsertLocality,
  getLocalityByHash,
  searchLocalities,
  getGeocodeCacheEntry,
  upsertGeocodeCache,
};

