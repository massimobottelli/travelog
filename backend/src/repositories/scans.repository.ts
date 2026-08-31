/**
 * Travelog MVP1 — Scans Repository
 *
 * Data access layer for scan records.
 */

import { db, pool as dbPool } from "../db/client.js";
import { scans, scanStatusEnum } from "../db/schema.js";
import { eq, desc, count } from "drizzle-orm";
import type { ScanRecord } from "../services/scans.service.js";

class ScansRepository {
  async createScan(folder: string): Promise<ScanRecord> {
    const result = await db
      .insert(scans)
      .values({
        folder,
        startedAt: new Date(),
        status: scanStatusEnum.enumValues[1], // 'running'
        filesAnalyzed: 0,
        newPhotos: 0,
        existingPhotos: 0,
        excludedPhotos: 0,
        errors: 0,
      })
      .returning();

    return result[0];
  }

  async getScan(id: number): Promise<ScanRecord | null> {
    const [row] = await db.select().from(scans).where(eq(scans.id, id));
    return row ?? null;
  }

  async listScans(offset: number, limit: number): Promise<ScanRecord[]> {
    return db.select().from(scans).orderBy(desc(scans.startedAt)).limit(limit).offset(offset);
  }

  async countScans(): Promise<number> {
    const [{ total }] = await db.select({ total: count() }).from(scans);
    return total;
  }

  async updateScan(
    id: number,
    updates: Partial<{
      folder: string;
      status: string;
      filesAnalyzed: number;
      newPhotos: number;
      existingPhotos: number;
      excludedPhotos: number;
      errors: number;
      errorMessage: string | null;
      endedAt: Date | null;
    }>,
  ): Promise<ScanRecord | null> {
    // Build partial values
    const values: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      if (key === "status") {
        values[key] = updates.status;
      } else if (key === "errorMessage" || key === "endedAt") {
        values[key] = updates[key as keyof typeof updates] ?? null;
      } else {
        values[key] = updates[key as keyof typeof updates];
      }
    }

    const [updated] = await db.update(scans).set(values).where(eq(scans.id, id)).returning();

    return updated ?? null;
  }

  /**
   * Try to acquire a PostgreSQL advisory lock.
   * Returns true if acquired, false otherwise.
   */
  async tryAcquireLock(lockID: number): Promise<boolean> {
    const client = await dbPool.connect();
    try {
      const result = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [lockID]);
      return Boolean(result.rows[0]?.locked);
    } finally {
      client.release();
    }
  }

  /**
   * Release a PostgreSQL advisory lock.
   */
  async releaseLock(lockID: number): Promise<void> {
    const client = await dbPool.connect();
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [lockID]);
    } finally {
      client.release();
    }
  }
}

export default new ScansRepository();
