/**
 * Travelog MVP1 — Config Controller
 */

import type { Request, Response } from "express";
import configService from "../services/config.service.js";

class ConfigController {
  async getConfig(_req: Request, res: Response): Promise<void> {
    const config = await configService.getRuntimeConfig();
    res.status(200).json(config);
  }

  async updateConfig(req: Request, res: Response): Promise<void> {
    const { photoRoot } = req.body as { photoRoot: string | null };
    const config = await configService.updatePhotoRoot(photoRoot);
    res.status(200).json(config);
  }
}

export default new ConfigController();
