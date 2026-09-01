/**
 * Travelog MVP1 — Photos Controller
 */

import type { Request, Response } from "express";
import photosService from "../services/photos.service.js";

class PhotosController {
  async listPhotos(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const metadataStatus =
      typeof req.query.metadataStatus === "string" && req.query.metadataStatus.length > 0
        ? req.query.metadataStatus
        : undefined;
    const result = await photosService.listPhotos(page, pageSize, metadataStatus);
    res.status(200).json(result);
  }
}

export default new PhotosController();
