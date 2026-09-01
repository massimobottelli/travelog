/**
 * Travelog MVP1 — Data Reset Service
 *
 * Explicit, user-triggered destructive maintenance operation: deletes
 * every catalogued row (photos, scans, errors, localities, geocoding
 * cache, presences, trips, trip history, settings, exclusion zones).
 *
 * The photo root configuration (.env) is intentionally preserved.
 *
 * Exclusivity is guaranteed with the same PostgreSQL advisory lock that
 * guards the scan lifecycle: while a scan is running the reset is
 * rejected with a conflict, and holding the lock prevents a scan from
 * starting mid-reset.
 */

import { pool as dbPool } from "../db/client.js";
import scansRepository from "../repositories/scans.repository.js";
import { ConflictError } from "../models/errors.js";
import { SCAN_LOCK_ID } from "../config/locks.js";

/**
 * All MVP1 tables. Kept explicit (instead of dynamic discovery) so the
 * destructive statement is auditable; a schema change must update it.
 */
const ALL_TABLES = [
  "photos",
  "scans",
  "scan_errors",
  "localities",
  "geocoding_cache",
  "presences",
  "trips",
  "trip_history",
  "settings",
  "exclusion_zones",
];

class DataResetService {
  async resetAllData(): Promise<void> {
    const acquired = await scansRepository.tryAcquireLock(SCAN_LOCK_ID);
    if (!acquired) {
      throw new ConflictError("Another scan is already running", "SCAN_ALREADY_RUNNING");
    }

    try {
      const client = await dbPool.connect();
      try {
        await client.query(`TRUNCATE TABLE ${ALL_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
      } finally {
        client.release();
      }
    } finally {
      await scansRepository.releaseLock(SCAN_LOCK_ID).catch(() => undefined);
    }
  }
}

export default new DataResetService();
