/**
 * Travelog MVP1 — Localities Routes (Phase 4)
 */

import { Router } from "express";
import localitiesController from "../controllers/localities.controller.js";

const router = Router();

router.get("/search", localitiesController.search);
router.get("/autocomplete", localitiesController.autocomplete);
router.post("/resolve", localitiesController.resolve);

export default router;
