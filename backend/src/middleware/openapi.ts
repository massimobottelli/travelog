/**
 * Travelog MVP1 — OpenAPI Request Validation Middleware (Skeleton)
 *
 * Maps Express routes to OpenAPI operationIds for future full schema validation.
 * Phase 2 validates required fields against OpenAPI spec; full AJV-based validation in Phase 3.
 */

import type { Request, Response, NextFunction } from "express";
import { loadOpenApiSpec } from "../utils/openapi.js";
import { ValidationError } from "../models/errors.js";

// Map route patterns to operationId (without API prefix)
const ROUTE_OPS: Record<string, Record<string, string>> = {
  "/health": { get: "getHealth" },
  "/config": { get: "getConfig", put: "updateConfig" },
  "/data": { delete: "deleteAllData" },
  "/scans": { post: "startScan", get: "listScans" },
  "/scans/:scanId": { get: "getScan" },
  "/scans/:scanId/errors": { get: "listScanErrors" },
  "/scans/:scanId/cancel": { post: "cancelScan" },
  "/photos": { get: "listPhotos" },
  "/trips": { get: "listTrips", post: "createTrip" },
  "/trips/:tripId": { get: "getTrip", patch: "updateTrip", delete: "deleteTrip" },
  "/trips/:tripId/split": { post: "splitTrip" },
  "/trips/merge": { post: "mergeTrips" },
  "/operations": { get: "listTripOperations" },
  "/settings": { get: "getSettings", put: "updateSettings", post: "recalculate" },
  "/exclusion-zones": {
    get: "listExclusionZones",
    post: "createExclusionZone",
    delete: "deleteExclusionZone",
  },
  "/localities/search": { get: "searchLocalities" },
};

function resolveOperationId(path: string, method: string): string | null {
  // Strip API prefix if present (e.g., /api/trips -> /trips)
  const apiPrefix = process.env.API_PREFIX ?? "/api";
  const basePath = path.startsWith(apiPrefix) ? path.slice(apiPrefix.length) || "/" : path;

  // Try exact match
  if (ROUTE_OPS[basePath]?.[method]) return ROUTE_OPS[basePath][method];

  // Wildcard match
  for (const [pattern, ops] of Object.entries(ROUTE_OPS)) {
    const regex = new RegExp("^" + pattern.replace(/:[^/]+/g, "[^/]+") + "$");
    if (regex.test(basePath) && ops[method]) return ops[method];
  }
  return null;
}

// Minimal required field check based on OpenAPI spec
const REQUIRED_BODY_FIELDS: Record<string, string[]> = {
  startScan: ["folder"],
  createTrip: ["startDate", "endDate"],
  updateTrip: [],
  splitTrip: ["splitDate"],
  mergeTrips: ["tripIds"],
  updateSettings: [],
  recalculate: [],
  createExclusionZone: ["localityId"],
};

export function openApiValidator(_req: Request, _res: Response, next: NextFunction): void {
  const operationId = resolveOperationId(_req.path, _req.method.toLowerCase());
  if (!operationId) {
    next();
    return;
  }

  // Validate required body fields for POST/PUT/PATCH operations.
  // "Required" means present and not null: an empty string is a valid
  // value (e.g. startScan with an empty folder scans the whole root).
  const requiredFields = REQUIRED_BODY_FIELDS[operationId] ?? [];
  if (
    requiredFields.length > 0 &&
    (_req.method === "POST" || _req.method === "PUT" || _req.method === "PATCH")
  ) {
    const missing = requiredFields.filter((f) => {
      const value = _req.body ? _req.body[f] : undefined;
      return value === undefined || value === null;
    });
    if (missing.length > 0) {
      next(
        new ValidationError(`Missing required fields: ${missing.join(", ")}`, { fields: missing }),
      );
      return;
    }
  }

  next();
}
