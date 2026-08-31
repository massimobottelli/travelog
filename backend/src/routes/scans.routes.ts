/**
 * Travelog MVP1 — Scans Routes
 */

import { Router } from "express";
import scansController from "../controllers/scans.controller.js";

const router = Router();

// POST /scans — start a new scan
router.post("/", scansController.startScan);

// GET /scans — list scan history (paginated)
router.get("/", scansController.listScans);

// GET /scans/:id — get scan status/progress
router.get("/:scanId", scansController.getScan);

export default router;
