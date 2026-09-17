/**
 * Travelog MVP1 — Photos Repository
 *
 * Data access layer for photo records.
 * Uses Drizzle ORM against PostgreSQL.
 */

import { db } from "../db/client.js";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PoolClient } from "pg";
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
  /** Null for excluded photos without a readable DateTimeOriginal. */
  dateTimeOriginal: Date | null;
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
export async function upsertPhoto(input: UpsertPhotoInput, client: PoolClient): Promise<number> {
  const transactionDb = drizzle(client);
  const [result] = await transactionDb
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
      metadataStatus: input.status,
      exclusionReason: input.exclusionReason,
    })
    .onConflictDoNothing({ target: [photos.filePath, photos.size, photos.mtime] })
    .returning({ id: photos.id });
  if (result) return result.id;

  // ON CONFLICT keeps the caller's transaction usable, unlike catching a
  // unique-constraint exception (which leaves PostgreSQL in an aborted state).
  const [existing] = await transactionDb
    .select({ id: photos.id })
    .from(photos)
    .where(
      and(
        eq(photos.filePath, input.filePath),
        eq(photos.size, input.size),
        eq(photos.mtime, input.mtime),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("Photo fingerprint conflict could not be resolved");
  return existing.id;
}

/**
 * Insert (or update) a photo as excluded due to incomplete/missing
 * EXIF metadata (functional requirements §5.5: excluded photos must be
 * registered in the database with their exclusion state and reason,
 * and must not be re-imported on subsequent scans).
 *
 * The shoot timestamp is unknown for these photos (often it is exactly
 * what is missing), so it is stored as null.
 */
export async function upsertExcludedPhoto(
  entry: Pick<ScanEntry, "absolutePath" | "fileName" | "fileType" | "size" | "mtime">,
  reason: string,
): Promise<void> {
  await db
    .insert(photos)
    .values({
      filePath: entry.absolutePath,
      fileName: entry.fileName,
      fileType: entry.fileType,
      size: entry.size,
      mtime: entry.mtime,
      dateTimeOriginal: null,
      originalLatitude: null,
      originalLongitude: null,
      metadataStatus: "excluded",
      exclusionReason: reason,
    })
    .onConflictDoUpdate({
      target: [photos.filePath, photos.size, photos.mtime],
      set: {
        metadataStatus: "excluded",
        exclusionReason: reason,
        updatedAt: new Date(),
      },
    });
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
    // Excluded photos have no shoot date: sort them last
    .orderBy(sql`photos.date_time_original desc nulls last`, desc(photos.id))
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
    dateTimeOriginal: exif.dateTimeOriginal ? new Date(exif.dateTimeOriginal) : null,
    latitude: exif.latitude,
    longitude: exif.longitude,
    status: isValid ? metadataStatusEnum.enumValues[0] : metadataStatusEnum.enumValues[1],
    exclusionReason,
  };
}

export default {
  findPhotoByFingerprint,
  upsertPhoto,
  upsertExcludedPhoto,
  buildPhotoInput,
  listPhotos,
};
