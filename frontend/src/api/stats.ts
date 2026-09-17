import { apiRequest } from "./client";
import type { components } from "./types";

export type TravelStats = components["schemas"]["TravelStats"];

export function getStats(): Promise<TravelStats> {
  return apiRequest<TravelStats>("/stats");
}
