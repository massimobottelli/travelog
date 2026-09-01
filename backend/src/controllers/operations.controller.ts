/**
 * Travelog MVP1 — Operations Controller (Phase 6)
 *
 * Manual trip operations: split (§13.3), merge (§13.4) and the
 * operations audit trail (§14).
 */

import type { Request, Response } from "express";
import tripOperationsService from "../services/trip-operations.service.js";
import operationsService from "../services/operations.service.js";

class OperationsController {
  async splitTrip(req: Request, res: Response): Promise<void> {
    const tripId = Number(req.params.tripId);
    const { splitDate, name } = req.body as { splitDate: string; name?: string };
    const result = await tripOperationsService.splitTrip(tripId, splitDate, name);
    res.status(200).json(result);
  }

  async mergeTrips(req: Request, res: Response): Promise<void> {
    const { tripIds, title } = req.body as { tripIds: number[]; title?: string | null };
    const result = await tripOperationsService.mergeTrips(tripIds.map(Number), title ?? undefined);
    res.status(200).json(result);
  }

  async listOperations(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const result = await operationsService.listOperations(page, pageSize);
    res.status(200).json(result);
  }
}

export default new OperationsController();
