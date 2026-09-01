/**
 * Travelog MVP1 — Data API module
 *
 * Destructive maintenance operations on catalogued data.
 */

import { apiRequest } from "./client";

/**
 * Irreversibly delete all catalogued data (photos, scans, errors,
 * localities, geocoding cache, presences, trips, history, settings).
 * The photo root configuration is preserved. Fails with 409 while a
 * scan is running.
 */
export function deleteAllData(): Promise<void> {
  return apiRequest<void>("/data", { method: "DELETE" });
}
