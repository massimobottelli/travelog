/**
 * Travelog MVP1 — Data Routes
 */

import { Router } from "express";
import dataController from "../controllers/data.controller.js";

const router = Router();

// DELETE /data — irreversibly delete all catalogued data
router.delete("/", dataController.deleteAllData);

export default router;
