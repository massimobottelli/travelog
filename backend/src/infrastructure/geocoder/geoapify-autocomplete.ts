/**
 * Travelog MVP1 — Geoapify Autocomplete Client
 *
 * Global locality search used by the exclusion zones UI. Proxies the
 * Geoapify Address Autocomplete API so the API key never leaves the
 * server and the frontend keeps using the internal API client.
 */

export interface LocalitySuggestion {
  placeId: string;
  name: string;
  countryCode: string;
  county: string | null;
  region: string | null;
  country: string | null;
  resultType: string | null;
  lat?: number;
  lon?: number;
}

/** Geoapify autocomplete/details feature properties (subset we need). */
export interface GeoapifyPlaceProperties {
  place_id?: string;
  name?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
  result_type?: string;
  lat?: number;
  lon?: number;
}

interface GeoapifyFeaturesResponse {
  features?: Array<{ properties?: GeoapifyPlaceProperties }>;
  error?: string;
}

/**
 * Map a Geoapify place to a Travelog suggestion.
 * The name prefers the administrative unit (city/town/village), not a POI.
 */
export function mapGeoapifyPlace(props: GeoapifyPlaceProperties): LocalitySuggestion | null {
  const placeId = props.place_id;
  if (!placeId) return null;
  const name =
    props.city || props.town || props.village || props.municipality || props.name || null;
  if (!name) return null;
  const countryCode = (props.country_code ?? "").toUpperCase();
  return {
    placeId,
    name,
    countryCode,
    county: props.county ?? null,
    region: props.state ?? null,
    country: props.country ?? null,
    resultType: props.result_type ?? null,
    lat: props.lat,
    lon: props.lon,
  };
}

const AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete";
const DETAILS_URL = "https://api.geoapify.com/v1/geocode/details";

export class GeoapifyAutocomplete {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async autocomplete(text: string, limit: number): Promise<LocalitySuggestion[]> {
    const url = new URL(AUTOCOMPLETE_URL);
    url.searchParams.set("text", text);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("apiKey", this.apiKey);

    const data = await this.request(url.toString(), text);
    const suggestions: LocalitySuggestion[] = [];
    for (const feature of data.features ?? []) {
      if (!feature.properties) continue;
      const mapped = mapGeoapifyPlace(feature.properties);
      if (mapped) suggestions.push(mapped);
    }
    return suggestions;
  }

  async resolvePlace(placeId: string): Promise<LocalitySuggestion | null> {
    const url = new URL(DETAILS_URL);
    url.searchParams.set("id", placeId);
    url.searchParams.set("apiKey", this.apiKey);

    const data = await this.request(url.toString(), placeId);
    const props = data.features?.[0]?.properties;
    if (!props) return null;
    return mapGeoapifyPlace(props);
  }

  private async request(url: string, context: string): Promise<GeoapifyFeaturesResponse> {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    } catch (err) {
      throw new Error(`[Geoapify] Request failed for "${context}": ${String(err)}`);
    }
    if (!response.ok) {
      throw new Error(`[Geoapify] HTTP ${response.status} for "${context}"`);
    }
    return (await response.json()) as GeoapifyFeaturesResponse;
  }
}
