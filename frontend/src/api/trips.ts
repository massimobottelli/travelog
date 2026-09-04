/**
 * Travelog MVP1 — Trips API module
 *
 * Semantic operations for trip consultation and manual modification
 * (functional requirements §15, §16, §13.1, §13.2).
 */

import {
  apiRequest,
  apiDownload,
  type Trip,
  type TripList,
  type TripDetail,
  type UpdateTripRequest,
  type CreateTripRequest,
  type ReplaceTripDaysRequest,
} from "./client";
import type { components } from "./types";

export type { TripList, TripDetail, UpdateTripRequest };
export type TripListStatus = components["schemas"]["TripListStatus"];

export interface TripsQuery {
  status?: TripListStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

/** List trips; by default only active trips are returned (§15). */
export function listTrips(query: TripsQuery = {}): Promise<TripList> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return apiRequest<TripList>(`/trips${qs ? `?${qs}` : ""}`);
}

/** Trip detail with the chronology of days and localities (§16). */
export function getTrip(tripId: number): Promise<TripDetail> {
  return apiRequest<TripDetail>(`/trips/${tripId}`);
}

/** Rename a trip and/or change its start/end dates (§13.1, §13.2). */
export function updateTrip(tripId: number, updates: UpdateTripRequest): Promise<TripDetail> {
  return apiRequest<TripDetail>(`/trips/${tripId}`, { method: "PATCH", body: updates });
}

/** Explicitly delete a trip whose period is not a trip. */
export function deleteTrip(tripId: number): Promise<void> {
  return apiRequest<void>(`/trips/${tripId}`, { method: "DELETE" });
}

/**
 * Create a trip manually: either with explicit start/end dates, or with
 * a list of manual days (each with the visited localities, resolved
 * beforehand via resolveLocality). With days, the interval is derived
 * server-side from the days.
 */
export function createTrip(request: CreateTripRequest): Promise<Trip> {
  return apiRequest<Trip>("/trips", { method: "POST", body: request });
}

/**
 * Full replacement of the manual days of a trip (add/remove days after
 * creation). Returns the updated trip detail.
 */
export function replaceTripDays(
  tripId: number,
  request: ReplaceTripDaysRequest,
): Promise<TripDetail> {
  return apiRequest<TripDetail>(`/trips/${tripId}/days`, { method: "PUT", body: request });
}

/**
 * Download the CSV export of all active trips (trip × day × locality
 * rows). The filename comes from the Content-Disposition header.
 */
export function exportTripsCsv(): Promise<void> {
  return apiDownload("/trips/export", "travelog-viaggi.csv");
}
