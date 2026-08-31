/**
 * Travelog MVP1 — Reverse Geocoding Interface
 *
 * Abstraction over external/local reverse geocoding providers.
 * Enables swapping Geoapify ↔ PostGIS ↔ Nominatim without changing callers.
 */

export interface Locality {
  /** ISO country code (alpha-2), e.g. "IT" */
  countryCode: string | null;
  /** Full country name, e.g. "Italy" */
  countryFull: string | null;
  /** Human-readable name at the matched level, e.g. "Monza" */
  name: string | null;
  /** Administrative level from the provider (type semantic) */
  adminLevel: number | null;
  /** County / province, e.g. "Trapani" */
  county: string | null;
  /** Parent region/state, e.g. "Sicily" */
  parentName: string | null;
  /** Parent country if different (rarely used) */
  parentCountryCode: string | null;
}

/**
 * Resolve GPS coordinates to a named locality.
 * Returns null when no result can be determined.
 */
export interface ReverseGeocoder {
  resolve(latitude: number, longitude: number): Promise<Locality | null>;
}
