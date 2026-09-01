/**
 * Travelog MVP1 — Geoapify Reverse Geocoder (Phase 4)
 */

import type { Locality, ReverseGeocoder } from "../../domain/reverse-geocoder.js";

interface GeoapifyResult {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
  result_type?: string;
}

interface GeoapifyResponse {
  results?: GeoapifyResult[];
}

export class GeoapifyReverseGeocoder implements ReverseGeocoder {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.geoapify.com/v1/geocode/reverse";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async resolve(latitude: number, longitude: number): Promise<Locality | null> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("apiKey", this.apiKey);
    url.searchParams.set("format", "json");

    try {
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        console.warn(`[Geoapify] HTTP ${response.status} for (${latitude}, ${longitude})`);
        return null;
      }

      const data = (await response.json()) as GeoapifyResponse;
      const result = data.results?.[0];
      if (!result || (!result.city && !result.town && !result.village)) return null;

      // Best locality name: prefer city/town/village (municipality level)
      const primaryName =
        result.city || result.town || result.village || result.municipality || null;

      // Country code uppercase + full name
      const countryCodeUpper = (result.country_code ?? "").toUpperCase();
      const countryCode = countryCodeUpper.length <= 2 ? countryCodeUpper : null;
      const countryFull = result.country ?? null;

      return {
        countryCode,
        countryFull,
        name: primaryName,
        adminLevel:
          result.result_type === "city" || result.result_type === "town"
            ? 4
            : result.result_type === "county"
              ? 6
              : 8,
        county: result.county ?? null,
        parentName: result.state ?? null,
        parentCountryCode: countryCode,
      };
    } catch (err) {
      console.warn(`[Geoapify] Request failed for (${latitude}, ${longitude}):`, err);
      return null;
    }
  }
}
