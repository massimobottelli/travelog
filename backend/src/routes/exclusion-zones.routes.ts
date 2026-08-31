/**
 * Travelog MVP1 — Exclusion Zones Routes
 */

import { Router } from "express";
import exclusionZonesController from "../controllers/exclusion-zones.controller.js";

const router = Router();

router.get("/", exclusionZonesController.listExclusionZones);
router.post("/", exclusionZonesController.createExclusionZone);
router.delete("/:id", exclusionZonesController.deleteExclusionZone);

export default router;
