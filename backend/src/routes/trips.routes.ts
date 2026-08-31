/**
 * Travelog MVP1 — Trips Routes
 */

import { Router } from "express";
import tripsController from "../controllers/trips.controller.js";

const router = Router();

// GET /trips — list trips (paginated, filterable)
router.get("/", tripsController.listTrips);

// POST /trips — create a trip manually
router.post("/", tripsController.createTrip);

// GET /trips/:tripId — get trip details
router.get("/:tripId", tripsController.getTrip);

// PATCH /trips/:tripId — update a trip
router.patch("/:tripId", tripsController.updateTrip);

export default router;
