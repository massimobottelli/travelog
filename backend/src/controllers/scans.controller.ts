/**
 * Travelog MVP1 — Scans Controller
 */

import type { Request, Response } from "express";
import scansService from "../services/scans.service.js";

class ScansController {
  async startScan(req: Request, res: Response): Promise<void> {
    const { folder } = req.body as { folder: string };
    const scan = await scansService.startScan(folder);
    res.status(202).json(scan);
  }

  async listScans(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const result = await scansService.listScans(page, pageSize);
    res.status(200).json(result);
  }

  async getScan(req: Request, res: Response): Promise<void> {
    const scanId = Number(req.params.scanId);
    const scan = await scansService.getScan(scanId);
    res.status(200).json(scan);
  }
}

export default new ScansController();
