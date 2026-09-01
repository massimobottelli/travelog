/**
 * Travelog MVP1 — Config API module
 *
 * Runtime configuration (photo root) management.
 */

import { apiRequest, type RuntimeConfig, type UpdateConfigRequest } from "./client";

/** Get the current runtime configuration (photo root, null when unset). */
export function getConfig(): Promise<RuntimeConfig> {
  return apiRequest<RuntimeConfig>("/config");
}

/**
 * Update the photo root. Persists the value in .env and applies it
 * immediately. An empty string clears the configuration.
 */
export function updateConfig(updates: UpdateConfigRequest): Promise<RuntimeConfig> {
  return apiRequest<RuntimeConfig>("/config", { method: "PUT", body: updates });
}
