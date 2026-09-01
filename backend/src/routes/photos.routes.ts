/**
 * Travelog MVP1 — Photos Routes
 */

import { Router } from "express";
import photosController from "../controllers/photos.controller.js";

const router = Router();

// GET /photos — list catalogued photos (paginated, technical metadata view)
router.get("/", photosController.listPhotos);

export default router;
