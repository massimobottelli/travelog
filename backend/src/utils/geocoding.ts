/**
 * Travelog MVP1 — Geocoding Utilities (Phase 4)
 *
 * Coordinate normalization and conversion helpers for
 * geographic reverse geocoding.
 */

/**
 * Round coordinates to 4 decimal places.
 * 4 decimals ≈ 11m precision at the equator.
 * This is used as the cache key so that nearby points hit the same cache entry.
 */
export function normalizeCoordinates(
  latitude: number,
  longitude: number,
): { normalizedLatitude: number; normalizedLongitude: number } {
  const scale = 10_000; // 4 decimal places
  return {
    normalizedLatitude: Math.round(latitude * scale) / scale,
    normalizedLongitude: Math.round(longitude * scale) / scale,
  };
}

/**
 * Build a PostGIS Point WKT string from raw lat/lng.
 * SRID 4326 = WGS84 (the standard GPS coordinate system).
 */
export function makePointWkt(
  latitude: number,
  longitude: number,
): string {
  return `POINT(${longitude} ${latitude})`;
}

/**
 * Build a SQL WHERE clause that finds the lowest-level administrative area
 * containing the given point. Uses ST_SetSRID on the stored WKT geometry.
 * Returns the raw SQL string together with its parameters.
 */
export function buildSpatialQueryWhereClause(
  latitude: number,
  longitude: number,
): { sql: string; params: [number, number] } {
  return {
    sql: `ST_GeomFromText($1, 4326) @> ST_SetSRID(ST_MakePoint($2, $3), 4326)`,
    params: [longitude, latitude],
  };
}
