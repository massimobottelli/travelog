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
    }).notNull(),
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

// ── 4. Administrative Areas ────────────────────────────────────────

export const administrativeAreas = pgTable(
  "administrative_areas",
  {
    id: serial("id").primaryKey(),
    datasetSource: varchar("dataset_source", { length: 50 }).notNull(),
    countryCode: varchar("country_code", { length: 5 }).notNull(),
    adminLevel: integer("admin_level").notNull(),
    name: text("name").notNull(),
    parentId: integer("parent_id"),
    geometry: text("geometry"), // WKT / GeoJSON consumed by PostGIS
    geoVersion: varchar("geo_version"),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: false,
    })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    idxAdminAreaCountryLevel: index("idx_administrative_areas_country_level").on(
      t.countryCode,
      t.adminLevel,
    ),
    idxAdminAreaParent: index("idx_admin_areas_parent_id").on(t.parentId),
  }),
);

// ── 5. Geocoding Cache ─────────────────────────────────────────────

export const geocodingCache = pgTable(
  "geocoding_cache",
  {
    id: serial("id").primaryKey(),
    normalizedLatitude: doublePrecision("normalized_latitude").notNull(),
    normalizedLongitude: doublePrecision("normalized_longitude").notNull(),
    adminAreaId: integer("admin_area_id").references(() => administrativeAreas.id),
    countryCode: varchar("country_code", { length: 5 }),
    adminLevel: integer("admin_level"),
    name: text("name"),
    geoVersion: varchar("geo_version").notNull(),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: false,
    })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueGeocodeKey: unique().on(t.normalizedLatitude, t.normalizedLongitude),
  }),
);

// ── 6. Presences ───────────────────────────────────────────────────

export const presences = pgTable(
  "presences",
  {
    id: serial("id").primaryKey(),
    photoDate: date("photo_date", { mode: "date" }).notNull(),
    adminAreaId: integer("admin_area_id").references(() => administrativeAreas.id),
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
    uniquePresence: unique().on(t.photoDate, t.adminAreaId),
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
  adminAreaId: integer("admin_area_id").references(() => administrativeAreas.id),
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: false,
  })
    .notNull()
    .defaultNow(),
});
