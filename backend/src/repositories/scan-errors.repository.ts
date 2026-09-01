/**
 * Travelog MVP1 — Scan Errors Repository
 *
 * Data access layer for individual file errors recorded during a scan.
 */

import { db } from "../db/client.js";
import { scanErrors } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

export interface InsertScanErrorInput {
  scanId: number;
  filePath: string;
  errorCode: string;
  message: string;
}

export interface ScanErrorRecord {
  id: number;
  scanId: number | null;
  filePath: string;
  errorCode: string;
  message: string;
  /** Naive local time as stored in the database ("YYYY-MM-DDTHH:mm:ss"). */
  createdAt: string;
}

/**
 * Record an error for a single photo processed during a scan.
 * Called within a DB transaction or directly outside photo's own transaction.
 */
export async function insertScanError(input: InsertScanErrorInput): Promise<void> {
  await db.insert(scanErrors).values({
    scanId: input.scanId,
    filePath: input.filePath,
    errorCode: input.errorCode,
    message: input.message,
  });
}

/**
 * List all errors recorded for a scan, ordered by insertion order.
 */
export async function listScanErrors(scanId: number): Promise<ScanErrorRecord[]> {
  return db
    .select({
      id: scanErrors.id,
      scanId: scanErrors.scanId,
      filePath: scanErrors.filePath,
      errorCode: scanErrors.errorCode,
      message: scanErrors.message,
      // Serialize the naive timestamp in SQL, independent of the server timezone
      createdAt: sql<string>`to_char(${scanErrors.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS')`,
    })
    .from(scanErrors)
    .where(eq(scanErrors.scanId, scanId))
    .orderBy(scanErrors.id);
}

export default {
  insertScanError,
  listScanErrors,
};
