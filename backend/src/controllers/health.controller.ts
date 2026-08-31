/**
 * Travelog MVP1 — Health Controller
 */

import type { Request, Response } from "express";
import healthService from "../services/health.service.js";

class HealthController {
  getHealth(_req: Request, res: Response): void {
    const status = healthService.getStatus();
    res.status(200).json(status);
  }
}

export default new HealthController();
