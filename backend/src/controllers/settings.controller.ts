/**
 * Travelog MVP1 — Settings Controller
 */

import type { Request, Response } from "express";
import settingsService from "../services/settings.service.js";

class SettingsController {
  async getSettings(_req: Request, res: Response): Promise<void> {
    const settings = await settingsService.getSettings();
    res.status(200).json(settings);
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    const updates = req.body as Partial<{
      minimumPhotosPerVisit: number;
      consecutiveDaysWithoutPhotosBeforeClosing: number;
    }>;
    const settings = await settingsService.updateSettings(updates);
    res.status(200).json(settings);
  }

  async recalculate(_req: Request, res: Response): Promise<void> {
    // Accepts the request immediately; actual calculation runs in background later
    res.status(202).json({ status: "ACCEPTED" });
  }
}

export default new SettingsController();
