/**
 * Travelog MVP1 — Health Routes
 */

import { Router } from "express";
import healthController from "../controllers/health.controller.js";

const router = Router();

router.get("/", healthController.getHealth);

export default router;
