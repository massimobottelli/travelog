/**
 * Travelog MVP1 — Global Error Handler Middleware
 *
 * Catches all errors and responds with the ApiError contract:
 *   { code, message, details }
 */

import type { Request, Response, NextFunction } from "express";
import pino from "pino";
import { AppError } from "../models/errors.js";

const logger = pino({ name: "travelog.error" });

/**
 * Express error handler middleware.
 * Must be registered last in the middleware chain.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const meta: Record<string, unknown> = {
    url: _req.url,
    method: _req.method,
    timestamp: new Date().toISOString(),
  };

  if (err instanceof AppError) {
    logger.warn({ ...meta, code: err.code }, err.message);
    res.status(err.statusCode).json(err.toApiError());
    return;
  }

  // Type-safe access for unknown errors
  const errorMessage =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);
  logger.error({ ...meta, error: errorMessage }, "Internal server error");

  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "An unexpected internal error occurred",
    details: {},
  });
}
