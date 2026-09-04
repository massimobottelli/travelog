/**
 * Travelog MVP1 — Geocoding Service (Phase 4 — Geoapify)
 *
 * Orchestrates reverse geocoding using Geoapify API with a persistent cache.
 * Pipeline: compute localityHash → check cache → call Geoapify if miss → persist.
 */

import geocodingRepository from "../repositories/geocoding.repository.js";
import { normalizeCoordinates, makeLocalityHash } from "../utils/geocoding.js";
import type { Locality, ReverseGeocoder } from "../domain/reverse-geocoder.js";
import {
  GeoapifyAutocomplete,
  type LocalitySuggestion,
} from "../infrastructure/geocoder/geoapify-autocomplete.js";
import { AppError } from "../models/errors.js";

export interface ReverseGeocodeResult {
  localityId: number | null;
  localityHash: string;
  countryCode: string | null;
  countryFull: string | null;
  name: string | null;
  county: string | null;
  adminLevel: number | null;
  region: string | null;
}

class GeocodingService {
  private geocoder: ReverseGeocoder | null = null;

  constructor(geoapifyApiKey: string | null) {
    if (geoapifyApiKey) {
      import("../infrastructure/geocoder/geoapify-reverse-geocoder.js")
        .then((m) => {
          this.geocoder = new m.GeoapifyReverseGeocoder(geoapifyApiKey);
        })
        .catch(() => {
          console.warn("[Geocoding] Geoapify module not loaded, geocoding disabled");
        });
    }
  }

  /**
   * Perform reverse geocoding for a single GPS point.
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
    const { normalizedLatitude, normalizedLongitude } = normalizeCoordinates(latitude, longitude);
    const localityHash = makeLocalityHash(normalizedLatitude, normalizedLongitude);

    // Check cache first (by exact original coordinates)
    const cached = await geocodingRepository.getGeocodeCacheEntry(latitude, longitude);
    if (cached && cached.localityId !== null) {
      return {
        localityId: cached.localityId,
        localityHash,
        countryCode: cached.countryCode,
        countryFull: null,
        name: cached.name,
        county: null,
        adminLevel: cached.adminLevel,
        region: null,
      };
    }

    let localityId: number | null = null;
    let name: string | null = null;
    let adminLevel: number | null = null;
    let countryCode: string | null = null;
    let county: string | null = null;
    let region: string | null = null;
    let countryFull: string | null = null;

    if (this.geocoder) {
      // Cache miss — call Geoapify
      const result = await this.geocoder.resolve(latitude, longitude);
      if (result) {
        const locality = await geocodingRepository.upsertLocality({
          localityHash,
          countryCode: result.countryCode ?? "",
          name: result.name ?? "Unknown",
          adminLevel: result.adminLevel ?? 0,
          county: result.county,
          region: result.parentName,
          country: result.countryFull,
        });
        localityId = locality.id;
        name = result.name;
        adminLevel = result.adminLevel;
        countryCode = result.countryCode;
        county = result.county;
        region = result.parentName;
        countryFull = result.countryFull;
      }
    }

    // Persist to cache
    await geocodingRepository.upsertGeocodeCache({
      latitude,
      longitude,
      localityHash,
      localityId,
      countryCode,
      name,
      adminLevel,
    });

    return {
      localityId,
      localityHash,
      countryCode,
      countryFull,
      name,
      county,
      adminLevel,
      region,
    };
  }

  /**
   * Search localities by name or parent region.
   */
  async searchLocalities(q: string, limit: number) {
    return geocodingRepository.searchLocalities(q, limit);
  }

  /** Autocomplete client (key read at call time so tests can configure it). */
  private getAutocomplete(): GeoapifyAutocomplete {
    const apiKey = process.env.GEOCOAPIFY_API_KEY ?? null;
    if (!apiKey) {
      throw new AppError(
        "GEOAPIFY_NOT_CONFIGURED",
        "Ricerca global non disponibile: chiave API Geoapify non configurata (GEOCOAPIFY_API_KEY)",
        503,
      );
    }
    return new GeoapifyAutocomplete(apiKey);
  }

  /**
   * Global place search via the Geoapify Address Autocomplete API.
   * Returns suggestions for any place worldwide, not only localities
   * already imported from photo geocoding.
   */
  async autocompleteLocalities(q: string, limit: number): Promise<LocalitySuggestion[]> {
    return this.getAutocomplete().autocomplete(q, limit);
  }

  /**
   * Resolve a Geoapify place id into a persisted Locality (upsert into
   * the localities table) so it can be referenced by exclusion zones.
   * Returns the contract Locality shape (api/types.ts).
   */
  async resolveLocality(placeId: string): Promise<{
    id: number;
    localityHash: string;
    source: string;
    countryCode: string;
    name: string;
    adminLevel: number;
    region: string | null;
    county: string | null;
    country: string | null;
  }> {
    const suggestion = await this.getAutocomplete().resolvePlace(placeId);
    if (!suggestion) {
      throw new AppError("PLACE_NOT_FOUND", "Place not found on Geoapify", 404);
    }

    let hash: string;
    if (typeof suggestion.lat === "number" && typeof suggestion.lon === "number") {
      // Use the normalized-coordinate hash so autocomplete-resolved
      // localities share the same key space as the ones created by the
      // photo geocoding pipeline.
      const { normalizedLatitude, normalizedLongitude } = normalizeCoordinates(
        suggestion.lat,
        suggestion.lon,
      );
      hash = makeLocalityHash(normalizedLatitude, normalizedLongitude);
    } else {
      hash = `geoapify:${placeId}`;
    }

    const row = await geocodingRepository.upsertLocality({
      localityHash: hash,
      countryCode: suggestion.countryCode,
      name: suggestion.name,
      adminLevel: 0,
      county: suggestion.county,
      region: suggestion.region,
      country: suggestion.country,
    });
    return {
      id: row.id,
      localityHash: row.localityHash,
      source: "geoapify-autocomplete",
      countryCode: row.countryCode,
      name: row.name,
      adminLevel: row.adminLevel,
      region: row.region,
      county: row.county,
      country: row.country,
    };
  }
}

export default new GeocodingService(process.env.GEOCOAPIFY_API_KEY ?? null);
