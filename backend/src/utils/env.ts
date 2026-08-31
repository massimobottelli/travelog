/**
 * Travelog MVP1 — Environment Configuration
 *
 * Typed access to environment variables with safe defaults.
 */

import dotenv from "dotenv";

dotenv.config();

export const env = {
  /** PostgreSQL connection string (required) */
  databaseUrl: required("DATABASE_URL"),

  /** Maximum PostgreSQL connection pool size */
  databasePoolMax: numberEnv("DATABASE_POOL_MAX", 10),

  /** Root directory of the photo archive mounted from the NAS (required at runtime) */
  photoRoot: process.env.TRAVELOG_PHOTO_ROOT,

  /** HTTP server bind address */
  host: process.env.HOST ?? "0.0.0.0",

  /** HTTP server port */
  port: numberEnv("PORT", 3000),

  /** REST API path prefix */
  apiPrefix: process.env.API_PREFIX ?? "/api",

  /** Allowed frontend origin for CORS */
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",

  /** Node.js runtime environment */
  nodeEnv: process.env.NODE_ENV ?? "development",

  /** Application log level */
  logLevel: (process.env.LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error",

  /** Path/name of the exiftool executable */
  exiftoolPath: process.env.EXIFTOOL_PATH ?? "exiftool",
} as const;

/**
 * Assert an environment variable is set, throw if missing.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Parse an integer from environment variable with a fallback.
 */
function numberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return fallback;
  return parsed;
}
