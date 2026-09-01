/**
 * Travelog MVP1 — Trip Operations API module
 *
 * Manual trip operations use cases: split (§13.3), merge (§13.4) and
 * the operations audit trail (§14).
 */

import {
  apiRequest,
  type TripOperationResult,
  type TripOperationList,
  type SplitTripRequest,
  type MergeTripsRequest,
} from "./client";

export type { TripOperationResult, TripOperationList };

/** Split a trip at the given date; the date belongs to the second trip. */
export function splitTrip(tripId: number, body: SplitTripRequest): Promise<TripOperationResult> {
  return apiRequest<TripOperationResult>(`/trips/${tripId}/split`, {
    method: "POST",
    body,
  });
}

/** Merge two or more trips into a new trip. */
export function mergeTrips(body: MergeTripsRequest): Promise<TripOperationResult> {
  return apiRequest<TripOperationResult>("/trips/merge", { method: "POST", body });
}

/** Chronological history of the trip operations (audit trail, §14). */
export function listTripOperations(page = 1): Promise<TripOperationList> {
  return apiRequest<TripOperationList>(`/operations?page=${page}`);
}
