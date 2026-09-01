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

// GET /trips/export — CSV export of all active trips
// (registered before /:tripId so "export" is not treated as an id)
router.get("/export", tripsController.exportTripsCsv);

// GET /trips/:tripId — get trip details
router.get("/:tripId", tripsController.getTrip);

// PATCH /trips/:tripId — update a trip
router.patch("/:tripId", tripsController.updateTrip);

// DELETE /trips/:tripId — explicitly delete a trip
router.delete("/:tripId", tripsController.deleteTrip);

export default router;
