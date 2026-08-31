/**
 * Travelog MVP1 — Environment Configuration
 */

import dotenv from "dotenv";

dotenv.config();

export const env = {
  get databaseUrl() { return required("DATABASE_URL"); },
  get databasePoolMax() { return numberEnv("DATABASE_POOL_MAX", 10); },
  get photoRoot() { return process.env.TRAVELOG_PHOTO_ROOT; },
  get host() { return process.env.HOST ?? "0.0.0.0"; },
  get port() { return numberEnv("PORT", 3000); },
  get apiPrefix() { return process.env.API_PREFIX ?? "/api"; },
  get corsOrigin() { return process.env.CORS_ORIGIN ?? "http://localhost:5173"; },
  get nodeEnv() { return process.env.NODE_ENV ?? "development"; },
  get logLevel() { return (process.env.LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error"; },
  get exiftoolPath() { return process.env.EXIFTOOL_PATH ?? "exiftool"; },
  get geoapifyApiKey() { return process.env.GEOCOAPIFY_API_KEY; },
} as const;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function numberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}
