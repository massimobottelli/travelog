/**
 * Travelog MVP1 — Data Controller
 */

import type { Request, Response } from "express";
import dataResetService from "../services/data-reset.service.js";

class DataController {
  async deleteAllData(_req: Request, res: Response): Promise<void> {
    await dataResetService.resetAllData();
    res.status(204).send();
  }
}

export default new DataController();
