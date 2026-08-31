/**
 * Travelog MVP1 — Geocoding Repository (Phase 4)
 */

import { pool as pgPool } from "../db/client.js";

export interface AdminAreaRow {
  id: number;
  datasetSource: string;
  countryCode: string;
  adminLevel: number;
  name: string;
  parentId: number | null;
}

export interface GeocodeResult {
  adminAreaId: number | null;
  name: string | null;
  countryCode: string | null;
  adminLevel: number | null;
}

export async function findAdminAreaByPoint(lat: number, lon: number): Promise<AdminAreaRow | null> {
  const result = await pgPool.query(
    `SELECT id, dataset_source, country_code, admin_level, name, parent_id
     FROM administrative_areas
     WHERE ST_Contains(ST_GeomFromText("geometry", 4326), ST_SetSRID(ST_MakePoint($1, $2), 4326))
     ORDER BY admin_level DESC
     LIMIT 1`,
    [lon, lat],
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    id: Number(r.id),
    datasetSource: r.dataset_source,
    countryCode: r.country_code,
    adminLevel: r.admin_level,
    name: r.name,
    parentId: r.parent_id ? Number(r.parent_id) : null,
  };
}

export async function resolveHierarchy(areaId: number): Promise<{name: string; adminLevel: number; countryCode: string}[]> {
  const tgt = await pgPool.query(`SELECT id, name, admin_level, country_code, parent_id FROM administrative_areas WHERE id=$1`, [areaId]);
  if (tgt.rows.length === 0) return [];
  const t = tgt.rows[0];
  const chain: {name: string; adminLevel: number; countryCode: string}[] = [{ name: t.name, adminLevel: t.admin_level, countryCode: t.country_code }];
  let currentParentId: number | null = t.parent_id ? Number(t.parent_id) : null;
  while (currentParentId !== null) {
    const res = await pgPool.query(`SELECT id, name, admin_level, country_code, parent_id FROM administrative_areas WHERE id=$1`, [currentParentId]);
    if (res.rows.length === 0) break;
    const p = res.rows[0];
    chain.unshift({ name: p.name, adminLevel: p.admin_level, countryCode: p.country_code });
    currentParentId = p.parent_id ? Number(p.parent_id) : null;
  }
  return chain;
}

export async function getGeocodeCacheEntry(
  normalizedLat: number,
  normalizedLon: number,
): Promise<{ adminAreaId: number | null; name: string | null; countryCode: string | null; adminLevel: number | null } | null> {
  const result = await pgPool.query(
    `SELECT admin_area_id, name, country_code, admin_level FROM geocoding_cache WHERE normalized_latitude=$1 AND normalized_longitude=$2`,
    [normalizedLat, normalizedLon],
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    adminAreaId: r.admin_area_id ? Number(r.admin_area_id) : null,
    name: r.name,
    countryCode: r.country_code,
    adminLevel: r.admin_level ? Number(r.admin_level) : null,
  };
}

export interface UpsertGeocodeInput {
  normalizedLatitude: number;
  normalizedLongitude: number;
}

export async function upsertGeocodeCache(
  input: UpsertGeocodeInput & {
    adminAreaId: number | null;
    countryCode: string | null;
    adminLevel: number | null;
    name: string | null;
    geoVersion: string;
  },
): Promise<void> {
  const nlat = input.normalizedLatitude;
  const nlon = input.normalizedLongitude;
  await pgPool.query(
    `INSERT INTO geocoding_cache (normalized_latitude, normalized_longitude, admin_area_id, country_code, admin_level, name, geo_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (normalized_latitude, normalized_longitude) DO UPDATE SET
       admin_area_id = EXCLUDED.admin_area_id,
       country_code = EXCLUDED.country_code,
       admin_level = EXCLUDED.admin_level,
       name = EXCLUDED.name,
       geo_version = EXCLUDED.geo_version`,
    [nlat, nlon, input.adminAreaId, input.countryCode, input.adminLevel, input.name, input.geoVersion],
  );
}

export async function recordDatasetVersion(input: { name: string; version: string; description?: string; rowCount: number }): Promise<number> {
  const result = await pgPool.query(
    `INSERT INTO dataset_versions (name, version, description, row_count) VALUES ($1, $2, $3, $4) RETURNING id`,
    [input.name, input.version, input.description ?? null, input.rowCount],
  );
  return Number(result.rows[0].id);
}

export async function getLatestDatasetVersion(
  name: string,
): Promise<{ id: number; version: string; description: string | null; importedAt: Date; rowCount: number | null } | null> {
  const result = await pgPool.query(
    `SELECT id, version, description, imported_at, row_count FROM dataset_versions WHERE name=$1 ORDER BY imported_at DESC LIMIT 1`,
    [name],
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    id: Number(r.id),
    version: r.version,
    description: r.description,
    importedAt: r.imported_at,
    rowCount: r.row_count,
  };
}

export default {
  findAdminAreaByPoint,
  resolveHierarchy,
  getGeocodeCacheEntry,
  upsertGeocodeCache,
  recordDatasetVersion,
  getLatestDatasetVersion,
};
