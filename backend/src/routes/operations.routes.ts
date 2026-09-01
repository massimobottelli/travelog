/**
 * Travelog MVP1 — Operations Routes
 *
 * Mounted at the API root: the split/merge paths match the OpenAPI
 * contract paths (/trips/{tripId}/split, /trips/merge); the audit trail
 * is exposed at /operations.
 */

import { Router } from "express";
import operationsController from "../controllers/operations.controller.js";

const router = Router();

// POST /trips/:tripId/split
router.post("/trips/:tripId/split", operationsController.splitTrip);

// POST /trips/merge
router.post("/trips/merge", operationsController.mergeTrips);

// GET /operations — list operation history (audit trail)
router.get("/operations", operationsController.listOperations);

export default router;
