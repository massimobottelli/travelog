/**
 * Travelog MVP1 — Scans Service
 */

import { db } from "../db/client.js";
import { scans, scanStatusEnum } from "../db/schema.js";
import scansRepository from "../repositories/scans.repository.js";
import { NotFoundError, ConflictError } from "../models/errors.js";
import { eq } from "drizzle-orm";
import { env } from "../utils/env.js";

export interface ScanRecord {
  id: number;
  folder: string;
  status: string;
  filesAnalyzed: number | null;
  newPhotos: number | null;
  existingPhotos: number | null;
  excludedPhotos: number | null;
  errors: number | null;
  startedAt: Date;
  errorMessage?: string | null;
  endedAt?: Date | null;
}

export interface ScanListResult {
  items: ScanRecord[];
  page: number;
  pageSize: number;
  total: number;
}

class ScansService {
  /**
   * Attempt to start a new scan.
   * Uses PostgreSQL advisory lock to prevent concurrent scans.
   */
  async startScan(folder: string): Promise<ScanRecord> {
    if (!folder || typeof folder !== "string") {
      throw new ConflictError("Invalid scan request", "SCAN_ALREADY_RUNNING");
    }

    const lockID = 70001; // Unique lock ID for scans
    const acquired = await scansRepository.tryAcquireLock(lockID);

    if (!acquired) {
      throw new ConflictError("Another scan is already running", "SCAN_ALREADY_RUNNING");
    }

    try {
      const scan = await db
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

      return scan[0];
    } catch (err) {
      // If insert fails, release the lock
      await scansRepository.releaseLock(lockID).catch(() => undefined);
      throw err;
    }
  }

  async listScans(page: number, pageSize: number): Promise<ScanListResult> {
    const offset = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      scansRepository.listScans(offset, pageSize),
      scansRepository.countScans(),
    ]);
    return { items: rows, page, pageSize, total };
  }

  async getScan(id: number): Promise<ScanRecord> {
    const scan = await scansRepository.getScan(id);
    if (!scan) {
      throw new NotFoundError("Scan", id);
    }
    return scan;
  }
}

export default new ScansService();
