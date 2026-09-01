/**
 * Travelog MVP1 — Settings API module
 *
 * Semantic operations for application settings and recalculation.
 */

import {
  apiRequest,
  type Settings,
  type UpdateSettingsRequest,
  type Recalculation,
} from "./client";

/** Get current global settings. */
export function getSettings(): Promise<Settings> {
  return apiRequest<Settings>("/settings");
}

/** Update one or more settings; omitted fields remain unchanged. */
export function updateSettings(updates: UpdateSettingsRequest): Promise<Settings> {
  return apiRequest<Settings>("/settings", { method: "PUT", body: updates });
}

/**
 * Trigger an explicit trip recalculation.
 * The operation returns immediately with ACCEPTED status.
 */
export function recalculate(): Promise<Recalculation> {
  return apiRequest<Recalculation>("/settings", { method: "POST" });
}
