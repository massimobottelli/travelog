/**
 * Travelog MVP1 — Exclusion Zones Controller
 */

import type { Request, Response } from "express";
import exclusionZonesService from "../services/exclusion-zones.service.js";

class ExclusionZonesController {
  async listExclusionZones(_req: Request, res: Response): Promise<void> {
    const zones = await exclusionZonesService.list();
    res.status(200).json({ items: zones });
  }

  async createExclusionZone(req: Request, res: Response): Promise<void> {
    const { administrativeAreaId } = req.body as { administrativeAreaId: number };
    const zone = await exclusionZonesService.create(administrativeAreaId);
    res.status(201).json(zone);
  }

  async deleteExclusionZone(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    await exclusionZonesService.delete(id);
    res.status(204).send();
  }
}

export default new ExclusionZonesController();
