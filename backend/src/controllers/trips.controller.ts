/**
 * Travelog MVP1 — Trips Controller
 */

import type { Request, Response } from "express";
import tripsService from "../services/trips.service.js";
import tripOperationsService from "../services/trip-operations.service.js";
import tripsRepository from "../repositories/trips.repository.js";
import tripMapService from "../services/trip-map.service.js";
import { NotFoundError } from "../models/errors.js";

class TripsController {
  async listTrips(req: Request, res: Response): Promise<void> {
    const status = req.query.status as "active" | "archived" | undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const sort =
      (req.query.sort as "startDateDesc" | "startDateAsc" | undefined) ?? "startDateDesc";
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

    const result = await tripsService.listTrips({ status, search, sort, page, pageSize });
    res.status(200).json(result);
  }

  async getTrip(req: Request, res: Response): Promise<void> {
    const tripId = Number(req.params.tripId);
    const trip = await tripsService.getTrip(tripId);
    res.status(200).json(trip);
  }

  async createTrip(req: Request, res: Response): Promise<void> {
    const { name, startDate, endDate, days } = req.body as {
      name?: string;
      startDate?: string;
      endDate?: string;
      days?: Array<{ date: string; localityIds: number[] }>;
    };
    const trip = await tripsService.createTrip({ name, startDate, endDate, days });
    res.status(201).json(trip);
  }

  /**
   * Full replacement of the manual days of a trip (manual trip creation
   * feature: add/remove days after creation).
   */
  async replaceTripDays(req: Request, res: Response): Promise<void> {
    const tripId = Number(req.params.tripId);
    const { days } = req.body as { days: Array<{ date: string; localityIds: number[] }> };
    const detail = await tripsService.replaceTripDays(tripId, days);
    res.status(200).json(detail);
  }

  async updateTrip(req: Request, res: Response): Promise<void> {
    const tripId = Number(req.params.tripId);
    const updates = req.body as Partial<{ name: string; startDate: string; endDate: string }>;
    const trip = await tripsService.updateTrip(tripId, updates);
    res.status(200).json(trip);
  }

  async deleteTrip(req: Request, res: Response): Promise<void> {
    const tripId = Number(req.params.tripId);
    await tripOperationsService.deleteTrip(tripId);
    res.status(204).send();
  }

  /**
   * CSV export of all active trips. Responds with a text/csv attachment
   * (UTF-8 BOM, `;` separator) instead of JSON.
   */
  async exportTripsCsv(_req: Request, res: Response): Promise<void> {
    const csv = await tripsService.exportTripsCsv();
    const today = new Date().toISOString().slice(0, 10);
    res
      .status(200)
      .set("Content-Type", "text/csv; charset=utf-8")
      .set("Content-Disposition", `attachment; filename="travelog-viaggi-${today}.csv"`)
      .send(csv);
  }

  /** Map visualization data for a trip (§16 / TripMap feature). */
  async getTripMap(req: Request, res: Response): Promise<void> {
    const tripId = Number(req.params.tripId);
    const trip = await tripsRepository.getTrip(tripId);
    if (!trip) throw new NotFoundError("Trip", tripId);

    const { markers, bounds } = await tripsRepository.getTripMapData(
      trip.id,
      trip.startDate,
      trip.endDate,
    );

    const { markersWithColor, countyColors } = tripMapService.assignCountyColors(markers);

    res.status(200).json({
      id: trip.id,
      name: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      bounds,
      markers: markersWithColor,
      countyColors,
    });
  }

  /**
   * Panoramic overview map of all active trips: one marker per unique
   * locality (deduplicated across trips). No trip header fields — the
   * overview is not tied to a single trip.
   */
  async getTripsOverviewMap(_req: Request, res: Response): Promise<void> {
    const { markers, bounds } = await tripsRepository.getTripsOverviewMapData();

    const { markersWithColor, countyColors } = tripMapService.assignCountyColors(markers);

    res.status(200).json({
      bounds,
      markers: markersWithColor,
      countyColors,
    });
  }
}

export default new TripsController();
