/**
 * Travelog MVP1 — Scans Service
 *
 * Orchestrates scan lifecycle including advisory locking,
 * background sequential processing of photos, transaction-per-photo,
 * and incremental idempotent scanning.
 */

import { eq, desc, and } from "drizzle-orm";
import { existsSync } from "node:fs";
import path from "node:path";
import { db, pool as dbPool } from "../db/client.js";
import { scans, scanStatusEnum } from "../db/schema.js";
import scansRepository from "../repositories/scans.repository.js";
import photosRepository from "../repositories/photos.repository.js";
import scanErrorsRepository, {
  type ScanErrorRecord,
} from "../repositories/scan-errors.repository.js";
import geocodingService from "../services/geocoding.service.js";
import { NotFoundError, ConflictError, ValidationError } from "../models/errors.js";
import { SCAN_LOCK_ID } from "../config/locks.js";
import { env } from "../utils/env.js";
import { enumerateSupportedFiles, type ScanEntry } from "../scans/photo-enumeration.js";
import { readExif } from "../scans/exiftool.js";

export interface ScanRecord {
  id: number;
  folder: string;
  status: string;
  filesAnalyzed: number | null;
  filesTotal: number | null;
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
  private readonly lockID = SCAN_LOCK_ID;

  async startScan(folder: string): Promise<ScanRecord> {
    // An empty folder scans the whole configured photo root
    if (typeof folder !== "string") {
      throw new ValidationError("Cartella di scansione non valida", { fields: ["folder"] });
    }
    // Fail fast when the photo root is not configured yet (user must set
    // it from the Settings page) or does not exist.
    const configuredRoot = env.photoRoot;
    if (!configuredRoot) {
      throw new ValidationError(
        "Percorso foto non configurato: impostalo nella pagina Impostazioni",
        { fields: ["photoRoot"] },
      );
    }
    if (!existsSync(configuredRoot)) {
      throw new ValidationError(`La directory root delle foto non esiste: ${configuredRoot}`, {
        fields: ["photoRoot"],
      });
    }
    const acquired = await scansRepository.tryAcquireLock(this.lockID);
    if (!acquired) {
      throw new ConflictError("Another scan is already running", "SCAN_ALREADY_RUNNING");
    }
    let scanRecord: ScanRecord | null = null;
    try {
      const result = await db
        .insert(scans)
        .values({
          folder,
          startedAt: new Date(),
          status: scanStatusEnum.enumValues[1],
          filesAnalyzed: 0,
          newPhotos: 0,
          existingPhotos: 0,
          excludedPhotos: 0,
          errors: 0,
        })
        .returning();
      scanRecord = result[0];
    } catch (err) {
      await scansRepository.releaseLock(this.lockID).catch(() => undefined);
      throw err;
    }
    this.runScan(scanRecord.id, folder).catch((err) => {
      console.error("[scanner] Fatal:", err);
    });
    return scanRecord;
  }

  private async runScan(scanId: number, folder: string): Promise<void> {
    const photoRoot = env.photoRoot;
    if (!photoRoot) {
      await this.finalizeWithError(scanId, "TRAVELOG_PHOTO_ROOT not configured");
      await scansRepository.releaseLock(this.lockID).catch(() => undefined);
      return;
    }
    const targetDir = path.join(photoRoot, folder);
    const cnt = { fa: 0, np: 0, ep: 0, xp: 0, er: 0 };
    try {
      const entries = await enumerateSupportedFiles(targetDir);
      console.log(`[scanner] Found ${entries.length} supported photos in ${targetDir}`);
      // The total is known right after enumeration (includes subfolders):
      // persist it so the frontend can render a proportional progress bar.
      await scansRepository
        .updateScan(scanId, { filesTotal: entries.length })
        .catch(() => undefined);
      for (const entry of entries) {
        cnt.fa++;
        try {
          await this.processPhoto(entry, scanId, cnt);
        } catch (err) {
          cnt.er++;
          const msg = err instanceof Error ? err.message : "Unknown";
          console.error(`[scanner] Process fail ${entry.fileName}:`, msg);
          await scanErrorsRepository
            .insertScanError({
              scanId,
              filePath: entry.absolutePath,
              errorCode: "FILE_PROCESSING_ERROR",
              message: msg,
            })
            .catch(() => {});
        } finally {
          await scansRepository
            .updateScan(scanId, {
              filesAnalyzed: cnt.fa,
              newPhotos: cnt.np,
              existingPhotos: cnt.ep,
              excludedPhotos: cnt.xp,
              errors: cnt.er,
            })
            .catch(() => {});
        }
      }
      console.log(`[scanner] Scan ${scanId} completed`);
      await this.finalizeSuccess(scanId, cnt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fatal error";
      await this.finalizeWithError(scanId, msg);
    } finally {
      await scansRepository.releaseLock(this.lockID).catch(() => undefined);
    }
  }

  private async processPhoto(
    entry: ScanEntry,
    scanId: number,
    cnt: Record<string, number>,
  ): Promise<void> {
    const ex = await photosRepository.findPhotoByFingerprint(
      entry.absolutePath,
      entry.size,
      entry.mtime,
    );
    if (ex) {
      cnt.ep++;
      return;
    }
    const exif = await readExif(entry.absolutePath);
    if (!exif) {
      cnt.er++;
      cnt.xp++;
      await scanErrorsRepository
        .insertScanError({
          scanId,
          filePath: entry.absolutePath,
          errorCode: "EXIF_READ_ERROR",
          message: "Failed to read EXIF",
        })
        .catch(() => {});
      await this.saveExcluded(entry, "EXIF unreadable");
      return;
    }
    const input = photosRepository.buildPhotoInput(entry, exif);
    if (input.status === "valid") {
      // Run geocoding before saving so cache is populated for future lookups
      if (input.latitude !== null && input.longitude !== null) {
        try {
          await geocodingService.reverseGeocode(input.latitude, input.longitude);
        } catch {
          /* geo fail does not block scan */
        }
      }
      await dbPool
        .connect()
        .then(async (cl) => {
          try {
            await cl.query("BEGIN");
            await photosRepository.upsertPhoto(input);
            await cl.query("COMMIT");
            cnt.np++;
          } catch (e) {
            await cl.query("ROLLBACK");
            throw e;
          }
        })
        .catch((err) => {
          cnt.er++;
          console.error(`[scanner] TX fail ${entry.fileName}:`, err);
        });
    } else {
      await this.saveExcluded(entry, input.exclusionReason ?? "Missing fields");
      cnt.xp++;
    }
  }

  private async saveExcluded(entry: ScanEntry, reason: string): Promise<void> {
    try {
      await dbPool.connect().then(async (cl) => {
        try {
          await cl.query("BEGIN");
          await photosRepository.markPhotoExcluded(
            entry.absolutePath,
            entry.size,
            entry.mtime,
            reason,
          );
          await cl.query("COMMIT");
        } catch (e) {
          await cl.query("ROLLBACK");
          throw e;
        }
      });
    } catch {}
  }

  private async finalizeSuccess(sid: number, cnt: Record<string, number>): Promise<void> {
    await scansRepository.updateScan(sid, {
      status: cnt.er > 0 ? scanStatusEnum.enumValues[3] : scanStatusEnum.enumValues[2],
      filesAnalyzed: cnt.fa,
      newPhotos: cnt.np,
      existingPhotos: cnt.ep,
      excludedPhotos: cnt.xp,
      errors: cnt.er,
      endedAt: new Date(),
    });
  }

  private async finalizeWithError(sid: number, msg: string): Promise<void> {
    await scansRepository.updateScan(sid, {
      status: scanStatusEnum.enumValues[4],
      endedAt: new Date(),
      errorMessage: msg,
    });
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
    if (!scan) throw new NotFoundError("Scan", id);
    return scan;
  }

  /**
   * List the per-file errors recorded for a scan.
   * The scan must exist, otherwise a 404 is raised.
   */
  async listScanErrors(scanId: number): Promise<ScanErrorRecord[]> {
    const scan = await scansRepository.getScan(scanId);
    if (!scan) throw new NotFoundError("Scan", scanId);
    return scanErrorsRepository.listScanErrors(scanId);
  }
}
export default new ScansService();
