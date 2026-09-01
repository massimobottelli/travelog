/**
 * Travelog MVP1 — Config Routes
 */

import { Router } from "express";
import configController from "../controllers/config.controller.js";

const router = Router();

// GET /config — current runtime configuration
router.get("/", configController.getConfig);

// PUT /config — update the photo root (persists to .env)
router.put("/", configController.updateConfig);

export default router;
