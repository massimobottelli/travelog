/**
 * Travelog MVP1 — Photos Repository
 *
 * Data access layer for photo records.
 * Uses Drizzle ORM against PostgreSQL.
 */

import { db, pool as dbPool } from "../db/client.js";
import { photos, geocodingCache, localities, metadataStatusEnum } from "../db/schema.js";
import { eq, and, desc, count, sql } from "drizzle-orm";
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
        .where(
          and(
            eq(photos.filePath, input.filePath),
            eq(photos.size, input.size),
            eq(photos.mtime, input.mtime),
          ),
        )
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

export interface PhotoLocality {
  countryCode: string;
  name: string;
  county: string | null;
  region: string | null;
  country: string | null;
}

export interface PhotoListItem {
  id: number;
  filePath: string;
  fileName: string;
  fileType: string;
  /** Naive local time as stored in the database ("YYYY-MM-DDTHH:mm:ss"). */
  dateTimeOriginal: string;
  originalLatitude: number | null;
  originalLongitude: number | null;
  metadataStatus: string;
  exclusionReason: string | null;
  locality: PhotoLocality | null;
}

export interface PhotoListResult {
  items: PhotoListItem[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * List catalogued photos ordered by shoot date (descending), paginated.
 *
 * Each photo is enriched with the hierarchical administrative locality
 * resolved by reverse geocoding, resolved through the geocoding cache
 * keyed on the original EXIF coordinates.
 */
export async function listPhotos(
  page: number,
  pageSize: number,
  metadataStatus?: "valid" | "excluded",
): Promise<PhotoListResult> {
  const offset = (page - 1) * pageSize;
  const where = metadataStatus ? eq(photos.metadataStatus, metadataStatus) : undefined;

  const rows = await db
    .select({
      id: photos.id,
      filePath: photos.filePath,
      fileName: photos.fileName,
      fileType: photos.fileType,
      // Serialize the naive timestamp in SQL so the value is independent
      // of the server timezone (EXIF DateTimeOriginal is naive local time).
      dateTimeOriginal: sql<string>`to_char(${photos.dateTimeOriginal}, 'YYYY-MM-DD"T"HH24:MI:SS')`,
      originalLatitude: photos.originalLatitude,
      originalLongitude: photos.originalLongitude,
      metadataStatus: photos.metadataStatus,
      exclusionReason: photos.exclusionReason,
      localityCountryCode: geocodingCache.countryCode,
      localityName: geocodingCache.name,
      localityCounty: localities.county,
      localityRegion: localities.region,
      localityCountry: localities.country,
    })
    .from(photos)
    .leftJoin(
      geocodingCache,
      and(
        eq(geocodingCache.originalLatitude, photos.originalLatitude),
        eq(geocodingCache.originalLongitude, photos.originalLongitude),
      ),
    )
    .leftJoin(localities, eq(localities.id, geocodingCache.localityId))
    .where(where)
    .orderBy(desc(photos.dateTimeOriginal), desc(photos.id))
    .limit(pageSize)
    .offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(photos).where(where);

  const items: PhotoListItem[] = rows.map((row) => ({
    id: row.id,
    filePath: row.filePath,
    fileName: row.fileName,
    fileType: row.fileType,
    dateTimeOriginal: row.dateTimeOriginal,
    originalLatitude: row.originalLatitude,
    originalLongitude: row.originalLongitude,
    metadataStatus: row.metadataStatus,
    exclusionReason: row.exclusionReason ?? null,
    locality:
      row.localityCountryCode && row.localityName
        ? {
            countryCode: row.localityCountryCode,
            name: row.localityName,
            county: row.localityCounty ?? null,
            region: row.localityRegion ?? null,
            country: row.localityCountry ?? null,
          }
        : null,
  }));

  return { items, page, pageSize, total };
}

/**
 * Convert a ScanEntry + ExifTool output into a photo insert/update input.
 */
export function buildPhotoInput(entry: ScanEntry, exif: RawExifData): UpsertPhotoInput {
  const isValid =
    exif.dateTimeOriginal !== null && exif.latitude !== null && exif.longitude !== null;

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
    dateTimeOriginal: exif.dateTimeOriginal
      ? new Date(exif.dateTimeOriginal)
      : new Date("1970-01-01"),
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
  listPhotos,
};
