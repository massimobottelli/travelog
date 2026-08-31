/**
 * Travelog MVP1 — Operations Routes
 */

import { Router } from "express";
import operationsController from "../controllers/operations.controller.js";

const router = Router();

// POST /trips/:tripId/split
router.post("/trips/:tripId/split", operationsController.splitTrip);

// POST /trips/merge
router.post("/trips/merge", operationsController.mergeTrips);

// GET /operations — list operation history
router.get("/", operationsController.listOperations);

export default router;
