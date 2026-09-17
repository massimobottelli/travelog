import { Router } from "express";
import { getTravelStats } from "../controllers/stats.controller.js";

const router = Router();
router.get("/", getTravelStats);
export default router;
