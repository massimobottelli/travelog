/**
 * Travelog MVP1 — Scan Errors Repository
 *
 * Data access layer for individual file errors recorded during a scan.
 */

import { db } from "../db/client.js";
import { scanErrors } from "../db/schema.js";

export interface InsertScanErrorInput {
  scanId: number;
  filePath: string;
  errorCode: string;
  message: string;
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

export default {
  insertScanError,
};
