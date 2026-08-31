/**
 * Travelog MVP1 — Photos Repository
 *
 * Data access layer for photo records.
 * Uses Drizzle ORM against PostgreSQL.
 */

import { db, pool as dbPool } from "../db/client.js";
import { photos, metadataStatusEnum } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { ScanEntry } from "../scans/photo-enumeration.js";
import type { RawExifData } from "../scans/exiftool.js";

export interface PhotoRecord {
  id: number;
  filePath: string;
  fileName: string;
  fileType: string;
  size: number;
  mtime: number;
  dateTimeOriginal: Date | null;
  originalLatitude: number | null;
  originalLongitude: number | null;
  metadataStatus: string;
  exclusionReason: string | null;
}

interface UpsertPhotoInput {
  filePath: string;
  fileName: string;
  fileType: string;
  size: number;
  mtime: number;
  dateTimeOriginal: Date;
  latitude: number | null;
  longitude: number | null;
  status: "valid" | "excluded";
  exclusionReason: string | null;
}

/**
 * Check whether a photo with the given fingerprint already exists.
 * Fingerprint = (file_path, size, mtime).
 */
export async function findPhotoByFingerprint(
  filePath: string,
  size: number,
  mtime: number,
): Promise<PhotoRecord | null> {
  const [result] = await db
    .select()
    .from(photos)
    .where(and(eq(photos.filePath, filePath), eq(photos.size, size), eq(photos.mtime, mtime)))
    .limit(1);

  return result ?? null;
}

/**
 * Insert or update a photo record within an existing transaction scope.
 * For new valid photos, this inserts the full metadata.
 * This is the write operation called inside each photo's transaction.
 */
export async function upsertPhoto(input: UpsertPhotoInput): Promise<number> {
  try {
    const [result] = await db
      .insert(photos)
      .values({
        filePath: input.filePath,
        fileName: input.fileName,
        fileType: input.fileType,
        size: input.size,
        mtime: input.mtime,
        dateTimeOriginal: input.dateTimeOriginal,
        originalLatitude: input.latitude,
        originalLongitude: input.longitude,
        metadataStatus: input.status as "valid" | "excluded",
        exclusionReason: input.exclusionReason,
      })
      .returning();
    return result.id;
  } catch (err: unknown) {
    // Unique constraint violation → photo already exists (idempotent scan)
    if (err instanceof Error && err.message.includes("unique")) {
      const [existing] = await db
        .select()
        .from(photos)
        .where(and(eq(photos.filePath, input.filePath), eq(photos.size, input.size), eq(photos.mtime, input.mtime)))
        .limit(1);
      if (existing) {
        return existing.id;
      }
    }
    throw err;
  }
}

/**
 * Mark a photo as excluded due to incomplete/missing EXIF metadata.
 * Called within a DB transaction during the scan pipeline.
 */
export async function markPhotoExcluded(
  filePath: string,
  size: number,
  mtime: number,
  reason: string,
): Promise<void> {
  await db
    .update(photos)
    .set({
      metadataStatus: "excluded",
      exclusionReason: reason,
    })
    .where(and(eq(photos.filePath, filePath), eq(photos.size, size), eq(photos.mtime, mtime)));
}

/**
 * Convert a ScanEntry + ExifTool output into a photo insert/update input.
 */
export function buildPhotoInput(
  entry: ScanEntry,
  exif: RawExifData,
): UpsertPhotoInput {
  const isValid =
    exif.dateTimeOriginal !== null &&
    exif.latitude !== null &&
    exif.longitude !== null;

  let exclusionReason: string | null = null;
  if (!isValid) {
    const reasons: string[] = [];
    if (!exif.dateTimeOriginal) reasons.push("MissingDateTimeOriginal");
    if (!exif.latitude || !exif.longitude) reasons.push("MissingGPS");
    exclusionReason = reasons.join("; ");
  }

  return {
    filePath: entry.absolutePath,
    fileName: entry.fileName,
    fileType: entry.fileType,
    size: entry.size,
    mtime: entry.mtime,
    dateTimeOriginal: exif.dateTimeOriginal ? new Date(exif.dateTimeOriginal) : new Date("1970-01-01"),
    latitude: exif.latitude,
    longitude: exif.longitude,
    status: isValid ? metadataStatusEnum.enumValues[0] : metadataStatusEnum.enumValues[1],
    exclusionReason,
  };
}

export default {
  findPhotoByFingerprint,
  upsertPhoto,
  markPhotoExcluded,
  buildPhotoInput,
};
