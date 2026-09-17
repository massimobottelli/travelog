/**
 * Travelog MVP1 — Settings Controller
 */

import type { Request, Response } from "express";
import settingsService from "../services/settings.service.js";
import tripCalculationService from "../services/trip-calculation.service.js";
import logger from "../config/logger.js";
import type { components } from "../api/types.js";
import { ValidationError } from "../models/errors.js";

class SettingsController {
  async getSettings(_req: Request, res: Response): Promise<void> {
    const settings = await settingsService.getSettings();
    res.status(200).json(settings);
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    const updates = req.body as Partial<{
      minimumConsecutiveDaysWithPhotos: number;
      consecutiveDaysWithoutPhotosBeforeClosing: number;
    }>;
    const settings = await settingsService.updateSettings(updates);
    res.status(200).json(settings);
  }

  async recalculate(req: Request, res: Response): Promise<void> {
    const { startDate, endDate } = (req.body ?? {}) as components["schemas"]["RecalculateRequest"];
    if ((startDate === undefined) !== (endDate === undefined)) {
      throw new ValidationError("Specificare sia la data inizio sia la data fine.");
    }
    if (startDate !== undefined && endDate !== undefined && startDate > endDate) {
      throw new ValidationError("La data fine deve essere uguale o successiva alla data inizio.");
    }
    const window =
      startDate !== undefined && endDate !== undefined ? { startDate, endDate } : undefined;
    // Explicit recalculation (requirements §12): rebuild the derived
    // presences and generate trips for data not yet consolidated, with the
    // current settings. Existing trips are never modified. The work runs
    // in the background; the 202 response follows the OpenAPI contract.
    void tripCalculationService
      .recalculate(window)
      .then((r) => logger.info({ ...window, tripsCreated: r.tripsCreated }, "recalculate.done"))
      .catch((err) => logger.error({ err, ...window }, "recalculate.failed"));
    res.status(202).json({ status: "ACCEPTED" });
  }
}

export default new SettingsController();
