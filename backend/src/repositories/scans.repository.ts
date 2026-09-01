/**
 * Travelog MVP1 — Scans Repository
 *
 * Data access layer for scan records.
 */

import { db, pool as dbPool } from "../db/client.js";
import { scans, scanStatusEnum } from "../db/schema.js";
import { eq, desc, count, inArray } from "drizzle-orm";
import type { PoolClient } from "pg";
import type { ScanRecord } from "../services/scans.service.js";

class ScansRepository {
  /** Pooled client currently owning the advisory lock, if any. */
  private lockClient: PoolClient | null = null;

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
      filesTotal: number | null;
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
   * Mark scans left in "running"/"pending" as failed.
   *
   * Called on backend startup: a scan job lives in this process
   * (technical design §31), so any running scan found at boot belongs
   * to a dead process (crash or restart) and can never finish.
   * Photos already saved remain in the database.
   */
  async failStaleRunningScans(): Promise<number> {
    const updated = await db
      .update(scans)
      .set({
        status: scanStatusEnum.enumValues[4], // failed
        endedAt: new Date(),
        errorMessage: "Scansione interrotta: riavvio del server",
      })
      .where(inArray(scans.status, ["pending", "running"]))
      .returning({ id: scans.id });
    return updated.length;
  }

  /**
   * Try to acquire a PostgreSQL advisory lock.
   *
   * The lock is session-level: the client that acquires it must be the
   * same one that releases it, otherwise `pg_advisory_unlock` on a
   * different pooled session fails silently and the lock stays held.
   * The owning client is therefore kept for the whole lock lifetime
   * and only returned to the pool on release.
   *
   * Returns true if acquired, false otherwise.
   */
  async tryAcquireLock(lockID: number): Promise<boolean> {
    const client = await dbPool.connect();
    try {
      const result = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [lockID]);
      if (!result.rows[0]?.locked) {
        client.release();
        return false;
      }
      this.lockClient = client;
      return true;
    } catch (err) {
      client.release();
      throw err;
    }
  }

  /**
   * Release a PostgreSQL advisory lock previously acquired with
   * tryAcquireLock, on the same session that owns it.
   */
  async releaseLock(_lockID: number): Promise<void> {
    const client = this.lockClient;
    this.lockClient = null;
    if (!client) return;
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [_lockID]);
    } finally {
      client.release();
    }
  }
}

export default new ScansRepository();
