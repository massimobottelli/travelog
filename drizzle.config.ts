/**
 * Drizzle Kit configuration — MVP1.
 *
 * All database schema changes must go through versioned Drizzle migrations
 * stored in `database/migrations/`.
 *
 * Usage:
 *   npm run db:generate   → generates migration SQL from schema changes
 *   npm run db:migrate    → runs pending migrations against DATABASE_URL
 *
 * DATABASE_URL is read from the single `.env` file at the repository root
 * (same source as the application, see backend/src/config/dotenv.ts);
 * an already-exported DATABASE_URL takes precedence.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(moduleDir, ".env"), override: false });

// drizzle-kit resolves `schema`/`out` relative to the process cwd, which
// differs between root and backend workspace invocations: anchor both to
// the repository root (the directory containing this config file).
export default defineConfig({
  schema: path.resolve(moduleDir, "backend/src/db/schema.ts"),
  out: path.resolve(moduleDir, "database/migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
