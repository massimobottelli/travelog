/**
 * Travelog MVP1 — Trips API module
 *
 * Semantic operations for trip consultation and manual modification
 * (functional requirements §15, §16, §13.1, §13.2).
 */

import {
  apiRequest,
  apiDownload,
  type TripList,
  type TripDetail,
  type UpdateTripRequest,
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
 * Download the CSV export of all active trips (trip × day × locality
 * rows). The filename comes from the Content-Disposition header.
 */
export function exportTripsCsv(): Promise<void> {
  return apiDownload("/trips/export", "travelog-viaggi.csv");
}
