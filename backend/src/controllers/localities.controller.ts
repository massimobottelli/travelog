/**
 * Travelog MVP1 — Localities Controller (Phase 4)
 */

import type { Request, Response } from "express";
import geocodingRepository from "../repositories/geocoding.repository.js";
import geocodingService from "../services/geocoding.service.js";
import { AppError } from "../models/errors.js";

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

  async autocomplete(req: Request, res: Response): Promise<void> {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));

    if (!q) {
      res.status(400).json({
        code: "VALIDATION_ERROR",
        message: 'Query parameter "q" is required',
        details: {},
      });
      return;
    }

    const items = await geocodingService.autocompleteLocalities(q, limit);
    res.status(200).json({ items });
  }

  async resolve(req: Request, res: Response): Promise<void> {
    const placeId = typeof req.body?.placeId === "string" ? req.body.placeId.trim() : "";
    if (!placeId) {
      throw new AppError("VALIDATION_ERROR", 'Field "placeId" is required', 400, {
        details: { fields: ["placeId"] },
      });
    }

    const locality = await geocodingService.resolveLocality(placeId);
    res.status(200).json(locality);
  }
}

export default new LocalitiesController();
