/**
 * Travelog MVP1 — Presences Repository (Phase 5)
 *
 * The presence is the fundamental domain unit: day + administrative
 * locality (requirements §7.2). Photo counts are maintained incrementally
 * during scans (one upsert per photo, inside the photo transaction) and
 * rebuilt from the photos table on explicit recalculation.
 */

import type { PoolClient } from "pg";
import { pool } from "../db/client.js";

export interface PresenceRow {
  /** Naive calendar date, YYYY-MM-DD. */
  photoDate: string;
  localityId: number;
  photoCount: number;
  /** Administrative locality data, used for exclusion matching and
   * aggregation of duplicate coordinate hashes of the same city. */
  name: string;
  countryCode: string;
  county: string | null;
  region: string | null;
}

/**
 * Increment (or create) the presence for a day + locality.
 * Must be called with the transaction client that owns the photo's
 * transaction (technical design §37: presence data is saved atomically
 * with the photo). The date is the naive EXIF DateTimeOriginal.
 */
export async function upsertPresence(
  client: PoolClient,
  photoDateTime: Date,
  localityId: number,
): Promise<void> {
  await client.query(
    `INSERT INTO presences (photo_date, locality_id, photo_count)
     VALUES (($1::timestamp)::date, $2, 1)
     ON CONFLICT (photo_date, locality_id)
     DO UPDATE SET photo_count = presences.photo_count + 1, updated_at = now()`,
    [photoDateTime, localityId],
  );
}

/**
 * Rebuild all presences from the photos table (explicit recalculation,
 * requirements §12). Presences are derived data: photos and geographic
 * data are never deleted by this operation. Runs in its own transaction.
 */
export async function rebuildFromPhotos(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE presences RESTART IDENTITY");
    await client.query(`
      INSERT INTO presences (photo_date, locality_id, photo_count)
      SELECT p.date_time_original::date, gc.locality_id, count(*)::int
      FROM photos p
      JOIN geocoding_cache gc
        ON gc.original_latitude = p.original_latitude
       AND gc.original_longitude = p.original_longitude
      WHERE p.metadata_status = 'valid'
        AND p.date_time_original IS NOT NULL
        AND gc.locality_id IS NOT NULL
      GROUP BY 1, 2
    `);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List all presences with a locality, ordered by date.
 * Dates are serialized in SQL (naive local time, timezone-independent).
 */
export async function listPresences(): Promise<PresenceRow[]> {
  const result = await pool.query(
    `SELECT to_char(p.photo_date, 'YYYY-MM-DD') AS photo_date,
            p.locality_id, p.photo_count,
            l.name, l.country_code, l.county, l.region
     FROM presences p
     JOIN localities l ON l.id = p.locality_id
     ORDER BY p.photo_date, p.locality_id`,
  );
  return result.rows.map((r) => ({
    photoDate: String(r.photo_date),
    localityId: Number(r.locality_id),
    photoCount: Number(r.photo_count),
    name: String(r.name),
    countryCode: String(r.country_code),
    county: r.county ?? null,
    region: r.region ?? null,
  }));
}

export default {
  upsertPresence,
  rebuildFromPhotos,
  listPresences,
};
