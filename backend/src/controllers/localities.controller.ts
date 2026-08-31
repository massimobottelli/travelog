/**
 * Travelog MVP1 — Localities Controller (Phase 4)
 */

import type { Request, Response } from "express";
import geocodingRepository from "../repositories/geocoding.repository.js";

class LocalitiesController {
  async search(req: Request, res: Response): Promise<void> {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    if (!q) {
      res.status(400).json({
        code: "VALIDATION_ERROR",
        message: 'Query parameter "q" is required',
        details: {},
      });
      return;
    }

    const results = await geocodingRepository.searchLocalities(q, limit);
    res.status(200).json({ items: results });
  }
}

export default new LocalitiesController();
