/**
 * Travelog MVP1 — Geocoding Utilities (Phase 4)
 *
 * Coordinate normalization and conversion helpers for geographic reverse geocoding.
 */

/**
 * Round coordinates to 2 decimal places.
 * 2 decimals ≈ 1km precision at the equator.
 * This is used as the cache key so that nearby points hit the same locality.
 * (~30 unique calls vs ~500 photos for a typical Milan-area scan).
 */
export function normalizeCoordinates(
  latitude: number,
  longitude: number,
): { normalizedLatitude: number; normalizedLongitude: number } {
  const scale = 100; // 2 decimal places
  return {
    normalizedLatitude: Math.round(latitude * scale) / scale,
    normalizedLongitude: Math.round(longitude * scale) / scale,
  };
}

/**
 * Create the locality hash key from rounded coordinates.
 * Format: "lat:lon" → e.g. "45.56:9.17"
 */
export function makeLocalityHash(lat: number, lon: number): string {
  return `${lat.toFixed(2)}:${lon.toFixed(2)}`;
}

