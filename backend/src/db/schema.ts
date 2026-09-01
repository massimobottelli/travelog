/**
 * Travelog MVP1 — Database Schema
 */

import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export const metadataStatusEnum = pgEnum("metadata_status", ["valid", "excluded"]);

export const scanStatusEnum = pgEnum("scan_status", [
  "pending",
  "running",
  "completed",
  "completed_with_errors",
  "failed",
  "stopped",
]);

export const tripOperationEnum = pgEnum("trip_operation", [
  "split",
  "merge",
  "rename",
  "date_change",
]);

export const tripStatusEnum = pgEnum("trip_status", ["active", "archived"]);

// ── 1. Photos ──────────────────────────────────────────────────────

export const photos = pgTable(
  "photos",
  {
    id: serial("id").primaryKey(),
    filePath: text("file_path").notNull(),
    fileName: text("file_name").notNull(),
    fileType: varchar("file_type", { length: 10 }).notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    mtime: bigint("mtime", { mode: "number" }).notNull(),
    dateTimeOriginal: timestamp("date_time_original", {
      mode: "date",
      withTimezone: false,
    }),
    originalLatitude: doublePrecision("original_latitude"),
    originalLongitude: doublePrecision("original_longitude"),
    metadataStatus: metadataStatusEnum("metadata_status").notNull().default("valid"),
    exclusionReason: text("exclusion_reason"),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: false,
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      withTimezone: false,
    })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueFingerprint: unique().on(t.filePath, t.size, t.mtime),
    idxPhotosDateTime: index("idx_photos_date_time_original").on(t.dateTimeOriginal),
  }),
);

// ── 2. Scans ───────────────────────────────────────────────────────

export const scans = pgTable(
  "scans",
  {
    id: serial("id").primaryKey(),
    folder: text("folder").notNull(),
    startedAt: timestamp("started_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    endedAt: timestamp("ended_at", { mode: "date", withTimezone: true }),
    status: scanStatusEnum("status").notNull(),
    filesAnalyzed: integer("files_analyzed").default(0),
    /** Total supported files found by enumeration (known when the scan starts processing). */
    filesTotal: integer("files_total"),
    newPhotos: integer("new_photos").default(0),
    existingPhotos: integer("existing_photos").default(0),
    excludedPhotos: integer("excluded_photos").default(0),
    errors: integer("errors").default(0),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: false,
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      withTimezone: false,
    })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    idxScansStartedAt: index("idx_scans_started_at").on(t.startedAt.desc()),
  }),
);

// ── 3. Scan Errors ─────────────────────────────────────────────────

export const scanErrors = pgTable(
  "scan_errors",
  {
    id: serial("id").primaryKey(),
    scanId: integer("scan_id").references(() => scans.id, { onDelete: "cascade" }),
    filePath: text("file_path").notNull(),
    errorCode: varchar("error_code", { length: 50 }).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: false,
    })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    idxScanErrorsScanId: index("idx_scan_errors_scan_id").on(t.scanId),
  }),
);

// ── 4. Localities ─────────────────────────────────────────────────
// Flat locality resolved from reverse-geocoding API (Geoapify).
// No geometries, no borders — just structured place data.
// The locality_hash enables fast deduplication for nearby coordinates.

export const localities = pgTable(
  "localities",
  {
    id: serial("id").primaryKey(),
    /** Cache key derived from rounded coordinates, e.g. "45.56:9.17" */
    localityHash: varchar("locality_hash", { length: 100 }).notNull(),
    countryCode: varchar("country_code", { length: 5 }).notNull(),
    name: text("name").notNull(),
    adminLevel: integer("admin_level").notNull(),
    street: varchar("street", { length: 200 }),
    county: varchar("county", { length: 200 }),
    region: varchar("region", { length: 200 }),
    country: varchar("country", { length: 200 }),
    rawResponse: jsonb("raw_response"),
    source: varchar("source", { length: 20 }).default("geoapify"),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: false,
    })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueLocalityHash: unique().on(t.localityHash),
  }),
);

// ── 5. Geocoding Cache ─────────────────────────────────────────────
// Maps every scanned photo coordinate to a locality via hash lookup.
// Original (unrounded) coordinates are preserved so photos keep their EXIF GPS.

export const geocodingCache = pgTable(
  "geocoding_cache",
  {
    id: serial("id").primaryKey(),
    originalLatitude: doublePrecision("original_latitude").notNull(),
    originalLongitude: doublePrecision("original_longitude").notNull(),
    localityHash: varchar("locality_hash", { length: 100 }).notNull(),
    localityId: integer("locality_id").references(() => localities.id),
    countryCode: varchar("country_code", { length: 5 }),
    name: text("name"),
    adminLevel: integer("admin_level"),
    geoApplied: boolean("geo_applied").default(false),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: false,
    })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueCoord: unique("unique_coord_on_original_lat_lon").on(
      t.originalLatitude,
      t.originalLongitude,
    ),
  }),
);

// ── 6. Presences ───────────────────────────────────────────────────

export const presences = pgTable(
  "presences",
  {
    id: serial("id").primaryKey(),
    photoDate: date("photo_date", { mode: "date" }).notNull(),
    localityId: integer("locality_id").references(() => localities.id),
    photoCount: integer("photo_count").default(1).notNull(),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: false,
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      withTimezone: false,
    })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniquePresence: unique().on(t.photoDate, t.localityId),
  }),
);

// ── 7. Trips ───────────────────────────────────────────────────────

export const trips = pgTable(
  "trips",
  {
    id: serial("id").primaryKey(),
    name: varchar({ length: 200 }).notNull(),
    startDate: date("start_date", { mode: "date" }).notNull(),
    endDate: date("end_date", { mode: "date" }).notNull(),
    autoGenerated: boolean("auto_generated").default(true),
    status: tripStatusEnum("status").default("active"),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: false,
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      withTimezone: false,
    })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    idxTripsStartDate: index("idx_trips_start_date").on(t.startDate.desc()),
  }),
);

// ── 8. Trip History (audit trail) ──────────────────────────────────

export const tripHistory = pgTable(
  "trip_history",
  {
    id: serial("id").primaryKey(),
    tripId: integer("trip_id").references(() => trips.id, { onDelete: "cascade" }),
    operation: tripOperationEnum("operation").notNull(),
    originalTripIds: jsonb("original_trip_ids").notNull(),
    resultTripIds: jsonb("result_trip_ids").notNull(),
    performedAt: timestamp("performed_at", {
      mode: "date",
      withTimezone: false,
    })
      .notNull()
      .defaultNow(),
    details: jsonb("details"),
  },
  (t) => ({
    idxTripHistoryTripId: index("idx_trip_history_trip_id").on(t.tripId),
  }),
);

// ── 9. Settings (singleton row) ────────────────────────────────────

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  minPhotoCountPerVisit: integer("min_photo_count_per_visit").notNull().default(1),
  daysWithoutPhotosThreshold: integer("days_without_photos_threshold").notNull().default(3),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: false,
  })
    .notNull()
    .defaultNow(),
});

// ── 10. Exclusion Zones ────────────────────────────────────────────

export const exclusionZones = pgTable("exclusion_zones", {
  id: serial("id").primaryKey(),
  localityId: integer("locality_id").references(() => localities.id),
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: false,
  })
    .notNull()
    .defaultNow(),
});
