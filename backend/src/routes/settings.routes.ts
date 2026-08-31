/**
 * Travelog MVP1 — Settings Routes
 */

import { Router } from "express";
import settingsController from "../controllers/settings.controller.js";

const router = Router();

// GET /settings — get current settings
router.get("/", settingsController.getSettings);

// PUT /settings — update settings
router.put("/", settingsController.updateSettings);

// POST /settings — trigger recalculation
router.post("/", settingsController.recalculate);

export default router;
