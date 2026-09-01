/**
 * Travelog MVP1 — Exclusion Zones Controller (Phase 4)
 */

import type { Request, Response } from "express";
import exclusionZonesService from "../services/exclusion-zones.service.js";

class ExclusionZonesController {
  async listExclusionZones(_req: Request, res: Response): Promise<void> {
    const zones = await exclusionZonesService.list();
    res.status(200).json({ items: zones });
  }

  async createExclusionZone(req: Request, res: Response): Promise<void> {
    const { localityId } = req.body as { localityId: number };
    const zone = await exclusionZonesService.create(localityId);
    res.status(201).json(zone);
  }

  async deleteExclusionZone(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    await exclusionZonesService.delete(id);
    res.status(204).send();
  }
}

export default new ExclusionZonesController();
