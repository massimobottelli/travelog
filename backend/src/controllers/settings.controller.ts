/**
 * Travelog MVP1 — Settings Controller
 */

import type { Request, Response } from "express";
import settingsService from "../services/settings.service.js";
import tripCalculationService from "../services/trip-calculation.service.js";

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

  async recalculate(_req: Request, res: Response): Promise<void> {
    // Explicit recalculation (requirements §12): rebuild the derived
    // presences and generate trips for data not yet consolidated, with the
    // current settings. Existing trips are never modified. The work runs
    // in the background; the 202 response follows the OpenAPI contract.
    void tripCalculationService
      .recalculate()
      .then((r) => console.log(`[recalculate] done: ${r.tripsCreated} new trip(s)`))
      .catch((err) => console.error("[recalculate] failed:", err));
    res.status(202).json({ status: "ACCEPTED" });
  }
}

export default new SettingsController();
