/**
 * Travelog MVP1 — Exclusion Zones API module
 *
 * Management of the geographic exclusion areas (functional requirements
 * §9): photos in these areas stay in the database but do not contribute
 * to trip statistics.
 */

import { apiRequest, type ExclusionZone, type Locality } from "./client";

export type { ExclusionZone, Locality };
export type LocalitySuggestion = import("./types").components["schemas"]["LocalitySuggestion"];

/** List the configured exclusion zones. */
export function listExclusionZones(): Promise<ExclusionZone[]> {
  return apiRequest<{ items: ExclusionZone[] }>("/exclusion-zones").then((res) => res.items);
}

/** Exclude a locality, its county (provincia) or its region. */
export function createExclusionZone(
  localityId: number,
  scope: "locality" | "county" | "region" = "locality",
): Promise<ExclusionZone> {
  return apiRequest<ExclusionZone>("/exclusion-zones", {
    method: "POST",
    body: { localityId, scope },
  });
}

/** Remove an exclusion zone. */
export function deleteExclusionZone(id: number): Promise<void> {
  return apiRequest<void>(`/exclusion-zones/${id}`, { method: "DELETE" });
}

/**
 * Global locality search via the Geoapify Address Autocomplete API
 * (backend proxy). Returns suggestions for any place worldwide, not
 * only localities already imported from photo geocoding.
 */
export function autocompleteLocalities(query: string): Promise<LocalitySuggestion[]> {
  return apiRequest<{ items: LocalitySuggestion[] }>(
    `/localities/autocomplete?q=${encodeURIComponent(query)}`,
  ).then((res) => res.items);
}

/**
 * Resolve a Geoapify place id into a persisted Locality (created in the
 * localities table if never geocoded before).
 */
export function resolveLocality(placeId: string): Promise<Locality> {
  return apiRequest<Locality>("/localities/resolve", {
    method: "POST",
    body: { placeId },
  });
}

/** Search localities already imported from photo geocoding. */
export function searchLocalities(query: string): Promise<Locality[]> {
  return apiRequest<{ items: Locality[] }>(
    `/localities/search?q=${encodeURIComponent(query)}`,
  ).then((res) => res.items);
}
