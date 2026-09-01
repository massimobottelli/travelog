/**
 * Travelog MVP1 — Express Application Configuration
 *
 * Assembles all middleware, routes, and error handlers.
 * This module is separate from entry point so tests can import `app`
 * without triggering server listen().
 */

import express from "express";
import cors from "cors";
import { loadOpenApiSpec } from "./utils/openapi.js";
import { openApiValidator } from "./middleware/openapi.js";
import { errorHandler } from "./middleware/error.js";
import healthRoutes from "./routes/health.routes.js";
import configRoutes from "./routes/config.routes.js";
import scansRoutes from "./routes/scans.routes.js";
import dataRoutes from "./routes/data.routes.js";
import photosRoutes from "./routes/photos.routes.js";
import tripsRoutes from "./routes/trips.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import exclusionZonesRoutes from "./routes/exclusion-zones.routes.js";
import localitiesRoutes from "./routes/localities.routes.js";
import operationsRoutes from "./routes/operations.routes.js";

export function createApp(): ReturnType<typeof express> {
  const API_PREFIX = process.env.API_PREFIX ?? "/api";

  const app = express();

  // ── Global middleware ────────────────────────────────────────
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());

  // ── Load OpenAPI spec (non-fatal if missing) ─────────────────
  try {
    loadOpenApiSpec();
  } catch (err) {
    console.error("[WARN] Failed to load OpenAPI spec:", err);
  }

  // OpenAPI validation middleware
  app.use(openApiValidator);

  // ── Routes ───────────────────────────────────────────────────
  app.use(`${API_PREFIX}/health`, healthRoutes);
  app.use(`${API_PREFIX}/config`, configRoutes);
  app.use(`${API_PREFIX}/data`, dataRoutes);
  app.use(`${API_PREFIX}/scans`, scansRoutes);
  app.use(`${API_PREFIX}/photos`, photosRoutes);
  app.use(`${API_PREFIX}/trips`, tripsRoutes);
  app.use(`${API_PREFIX}/settings`, settingsRoutes);
  app.use(`${API_PREFIX}/exclusion-zones`, exclusionZonesRoutes);
  app.use(`${API_PREFIX}/localities`, localitiesRoutes);
  // Trip operations expose paths under /trips/* and /operations:
  // mounted at the API root AFTER the trips router so that
  // POST /api/trips/:id/split and /api/trips/merge resolve correctly.
  app.use(API_PREFIX, operationsRoutes);

  // ── Error handler (MUST be last) ─────────────────────────────
  app.use(errorHandler);

  return app;
}
