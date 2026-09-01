/**
 * Drizzle Kit configuration — MVP1.
 *
 * All database schema changes must go through versioned Drizzle migrations
 * stored in `database/migrations/`.
 *
 * Usage:
 *   npm run db:generate   → generates migration SQL from schema changes
 *   npm run db:migrate    → runs pending migrations against DATABASE_URL
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./backend/src/db/schema.ts",
  out: "./database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
