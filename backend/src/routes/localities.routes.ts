/**
 * Travelog MVP1 — Localities Routes (Phase 4)
 */

import { Router } from "express";
import localitiesController from "../controllers/localities.controller.js";

const router = Router();

router.get("/search", localitiesController.search);

export default router;
