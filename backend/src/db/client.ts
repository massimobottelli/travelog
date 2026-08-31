/**
 * Database connection singleton for Travelog MVP1.
 *
 * Uses `pg` pool + Drizzle ORM with PostgreSQL/PostGIS.
 * Connection string comes from `DATABASE_URL` environment variable.
 */

import dotenv from "dotenv";
dotenv.config();

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const poolMax = Number(process.env.DATABASE_POOL_MAX) || 10;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: poolMax,
});

export const db = drizzle(pool, {
  logger: process.env.NODE_ENV === "development",
});

/**
 * Gracefully close the pool on process exit.
 */
process.on("SIGINT", () => {
  pool.end();
  process.exit(0);
});

process.on("SIGTERM", () => {
  pool.end();
  process.exit(0);
});

/**
 * Create an in-memory Drizzle client for testing against a test database
 * without requiring the global pool. Useful for integration tests.
 */
export function createTestDb(connectionString?: string) {
  const testPool = new Pool({
    connectionString: connectionString ?? process.env.DATABASE_URL,
    max: 5,
  });
  return drizzle(testPool, { logger: false });
}
