/**
 * Travelog MVP1 — Trips Controller
 */

import type { Request, Response } from "express";
import tripsService from "../services/trips.service.js";
import tripOperationsService from "../services/trip-operations.service.js";

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
    const { name, startDate, endDate } = req.body as {
      name?: string;
      startDate: string;
      endDate: string;
    };
    const trip = await tripsService.createTrip({ name, startDate, endDate });
    res.status(201).json(trip);
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
}

export default new TripsController();
