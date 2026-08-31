/**
 * Travelog MVP1 — Administrative Areas Routes
 */

import { Router } from "express";
import adminAreasController from "../controllers/admin-areas.controller.js";

const router = Router();

router.get("/search", adminAreasController.search);

export default router;
