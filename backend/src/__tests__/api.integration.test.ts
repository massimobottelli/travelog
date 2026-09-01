/**
 * Travelog MVP1 — API integration tests
 *
 * Uses the real PostgreSQL test database (travelog_test).
 * Covers the endpoints exercised by the frontend MVP1 scope:
 * photos listing (technical view), scan errors and settings contract.
 */

import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { pool } from "../db/client.js";

const server = createApp();

// ── Fixtures ─────────────────────────────────────────────────

async function insertLocality(hash: string, name: string): Promise<number> {
  const res = await pool.query(
    `INSERT INTO localities (locality_hash, country_code, name, admin_level, county, region, country)
     VALUES ($1, 'IT', $2, 8, 'Milano', 'Lombardia', 'Italy') RETURNING id`,
    [hash, name],
  );
  return res.rows[0].id as number;
}

async function insertGeocodeCacheEntry(
  lat: number,
  lon: number,
  hash: string,
  localityId: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO geocoding_cache (original_latitude, original_longitude, locality_hash, locality_id, country_code, name, admin_level, geo_applied)
     VALUES ($1, $2, $3, $4, 'IT', 'Monza', 8, true)`,
    [lat, lon, hash, localityId],
  );
}

async function insertPhoto(options: {
  filePath: string;
  fileName: string;
  dateTimeOriginal: string;
  lat: number | null;
  lon: number | null;
  status?: "valid" | "excluded";
  exclusionReason?: string | null;
}): Promise<number> {
  const res = await pool.query(
    `INSERT INTO photos (file_path, file_name, file_type, size, mtime, date_time_original, original_latitude, original_longitude, metadata_status, exclusion_reason)
     VALUES ($1, $2, 'jpg', 1234, 1700000000, $3, $4, $5, $6, $7) RETURNING id`,
    [
      options.filePath,
      options.fileName,
      options.dateTimeOriginal,
      options.lat,
      options.lon,
      options.status ?? "valid",
      options.exclusionReason ?? null,
    ],
  );
  return res.rows[0].id as number;
}

async function insertScanWithErrors(): Promise<number> {
  const res = await pool.query(
    `INSERT INTO scans (folder, started_at, status, files_analyzed, files_total, new_photos, existing_photos, excluded_photos, errors)
     VALUES ('test-folder', now(), 'completed_with_errors', 10, 10, 5, 3, 1, 1) RETURNING id`,
  );
  const scanId = res.rows[0].id as number;
  await pool.query(
    `INSERT INTO scan_errors (scan_id, file_path, error_code, message)
     VALUES ($1, '/photos/broken.jpg', 'EXIF_READ_ERROR', 'Failed to read EXIF')`,
    [scanId],
  );
  return scanId;
}

// ── Cleanup ──────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  await pool.query("DELETE FROM photos WHERE file_path LIKE 'api-test/%'");
  await pool.query("DELETE FROM geocoding_cache WHERE original_latitude = 45.5641");
  await pool.query("DELETE FROM localities WHERE locality_hash LIKE 'test-hash-%'");
  await pool.query("DELETE FROM scans WHERE folder = 'test-folder'");
  await pool.query("DELETE FROM settings");
}

afterAll(async () => {
  await cleanup();
  await pool.end();
});

// ── Tests ────────────────────────────────────────────────────

describe("GET /api/health", () => {
  it("responds with ok status", async () => {
    const res = await request(server).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("GET /api/photos", () => {
  it("returns photos with shoot timestamp, GPS and hierarchical locality", async () => {
    const localityId = await insertLocality("test-hash-1", "Monza");
    await insertGeocodeCacheEntry(45.5641, 9.1742, "test-hash-1", localityId);
    const withLocality = await insertPhoto({
      filePath: "api-test/monza.jpg",
      fileName: "monza.jpg",
      dateTimeOriginal: "2025-08-10 15:30:00",
      lat: 45.5641,
      lon: 9.1742,
    });
    const withoutLocality = await insertPhoto({
      filePath: "api-test/no-gps.jpg",
      fileName: "no-gps.jpg",
      dateTimeOriginal: "2025-08-12 09:00:00",
      lat: null,
      lon: null,
      status: "excluded",
      exclusionReason: "MissingGPS",
    });

    const res = await request(server).get("/api/photos?page=1&pageSize=20");
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    expect(res.body.page).toBe(1);

    const monza = res.body.items.find((p: { id: number }) => p.id === withLocality);
    expect(monza).toMatchObject({
      id: withLocality,
      fileName: "monza.jpg",
      dateTimeOriginal: "2025-08-10T15:30:00",
      originalLatitude: 45.5641,
      originalLongitude: 9.1742,
      metadataStatus: "valid",
    });
    expect(monza.locality).toEqual({
      countryCode: "IT",
      name: "Monza",
      county: "Milano",
      region: "Lombardia",
      country: "Italy",
    });

    const excluded = res.body.items.find((p: { id: number }) => p.id === withoutLocality);
    expect(excluded.metadataStatus).toBe("excluded");
    expect(excluded.exclusionReason).toBe("MissingGPS");
    expect(excluded.originalLatitude).toBeNull();
    expect(excluded.locality).toBeNull();
  });

  it("orders photos by shoot date descending and paginates", async () => {
    await insertPhoto({
      filePath: "api-test/older.jpg",
      fileName: "older.jpg",
      dateTimeOriginal: "2024-01-01 08:00:00",
      lat: null,
      lon: null,
    });

    const page1 = await request(server).get("/api/photos?page=1&pageSize=1");
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(1);
    expect(page1.body.total).toBeGreaterThanOrEqual(3);

    const page2 = await request(server).get("/api/photos?page=2&pageSize=1");
    expect(page2.status).toBe(200);
    // Descending order: page 2 must be older than page 1
    expect(page2.body.items[0].dateTimeOriginal <= page1.body.items[0].dateTimeOriginal).toBe(true);
  });

  it("rejects an invalid metadataStatus filter with the error contract", async () => {
    const res = await request(server).get("/api/photos?metadataStatus=bogus");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(typeof res.body.message).toBe("string");
  });

  it("filters by metadataStatus", async () => {
    const res = await request(server).get("/api/photos?metadataStatus=excluded");
    expect(res.status).toBe(200);
    for (const photo of res.body.items) {
      expect(photo.metadataStatus).toBe("excluded");
    }
  });
});

describe("GET /api/scans/:scanId", () => {
  it("returns the scan including the enumerated files total", async () => {
    const scanId = await insertScanWithErrors();

    const res = await request(server).get(`/api/scans/${scanId}`);
    expect(res.status).toBe(200);
    expect(res.body.filesTotal).toBe(10);
    expect(res.body.filesAnalyzed).toBe(10);
  });
});

describe("GET /api/scans/:scanId/errors", () => {
  it("returns the per-file errors of a scan", async () => {
    const scanId = await insertScanWithErrors();

    const res = await request(server).get(`/api/scans/${scanId}/errors`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      scanId,
      filePath: "/photos/broken.jpg",
      errorCode: "EXIF_READ_ERROR",
      message: "Failed to read EXIF",
    });
    expect(typeof res.body.items[0].createdAt).toBe("string");
  });

  it("returns 404 with the error contract for an unknown scan", async () => {
    const res = await request(server).get("/api/scans/999999/errors");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("scan_not_found");
    expect(typeof res.body.message).toBe("string");
  });
});

describe("GET/PUT /api/settings", () => {
  it("returns settings following the OpenAPI contract shape", async () => {
    const res = await request(server).get("/api/settings");
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      "consecutiveDaysWithoutPhotosBeforeClosing",
      "minimumPhotosPerVisit",
    ]);
    expect(res.body.minimumPhotosPerVisit).toBe(1);
    expect(res.body.consecutiveDaysWithoutPhotosBeforeClosing).toBe(3);
  });

  it("updates settings and returns the contract shape", async () => {
    const res = await request(server)
      .put("/api/settings")
      .send({ minimumPhotosPerVisit: 5, consecutiveDaysWithoutPhotosBeforeClosing: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      minimumPhotosPerVisit: 5,
      consecutiveDaysWithoutPhotosBeforeClosing: 2,
    });

    const after = await request(server).get("/api/settings");
    expect(after.body.minimumPhotosPerVisit).toBe(5);
  });
});

describe("POST /api/scans", () => {
  it("accepts an empty folder (whole photo root) and fails only on the photo root check", async () => {
    // Force an unconfigured photo root so the request stops before any
    // real scanning; the point is that an empty folder passes body validation.
    const original = process.env.TRAVELOG_PHOTO_ROOT;
    process.env.TRAVELOG_PHOTO_ROOT = "";
    try {
      const res = await request(server).post("/api/scans").send({ folder: "" });
      expect(res.status).toBe(400);
      // If the empty folder were rejected as missing, the message would be
      // about required fields; it must instead be the photo root check.
      expect(res.body.message).toContain("Percorso foto non configurato");
    } finally {
      process.env.TRAVELOG_PHOTO_ROOT = original;
    }
  });

  it("rejects a request without the folder field", async () => {
    const res = await request(server).post("/api/scans").send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET/PUT /api/config", () => {
  it("returns the runtime configuration following the contract shape", async () => {
    const res = await request(server).get("/api/config");
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["photoRoot"]);
    // The value mirrors TRAVELOG_PHOTO_ROOT from the real root .env,
    // which the user may have configured from the UI: only the type
    // of the value is asserted here, not its content.
    const value = res.body.photoRoot;
    expect(value === null || typeof value === "string").toBe(true);
  });

  it("rejects a relative photo root path with the error contract", async () => {
    const res = await request(server).put("/api/config").send({ photoRoot: "relative/photos" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a non-existent photo root directory", async () => {
    const res = await request(server)
      .put("/api/config")
      .send({ photoRoot: "/travelog-test-does-not-exist-xyz" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("DELETE /api/data", () => {
  it("irreversibly deletes every catalogued row and resets settings to defaults", async () => {
    // Seed rows across the main tables (unique coordinates to avoid
    // clashing with the geocoding fixtures used by other tests)
    const localityId = await insertLocality("test-hash-reset", "ResetCity");
    await insertGeocodeCacheEntry(45.9911, 9.9911, "test-hash-reset", localityId);
    await insertPhoto({
      filePath: "api-test/reset.jpg",
      fileName: "reset.jpg",
      dateTimeOriginal: "2025-01-01 10:00:00",
      lat: null,
      lon: null,
    });
    await insertScanWithErrors();
    await request(server).put("/api/settings").send({ minimumPhotosPerVisit: 7 });

    const res = await request(server).delete("/api/data");
    expect(res.status).toBe(204);

    const counts = await pool.query(
      `SELECT
         (SELECT count(*) FROM photos) AS photos,
         (SELECT count(*) FROM scans) AS scans,
         (SELECT count(*) FROM scan_errors) AS scan_errors,
         (SELECT count(*) FROM geocoding_cache) AS geocoding_cache,
         (SELECT count(*) FROM localities) AS localities,
         (SELECT count(*) FROM presences) AS presences,
         (SELECT count(*) FROM trips) AS trips,
         (SELECT count(*) FROM trip_history) AS trip_history,
         (SELECT count(*) FROM settings) AS settings,
         (SELECT count(*) FROM exclusion_zones) AS exclusion_zones`,
    );
    const row = counts.rows[0];
    for (const value of Object.values(row)) {
      expect(Number(value)).toBe(0);
    }

    // Settings fall back to defaults on next access
    const settings = await request(server).get("/api/settings");
    expect(settings.status).toBe(200);
    expect(settings.body.minimumPhotosPerVisit).toBe(1);
    expect(settings.body.consecutiveDaysWithoutPhotosBeforeClosing).toBe(3);
  });
});

describe("POST /api/settings (recalculate)", () => {
  it("accepts the explicit recalculation request", async () => {
    const res = await request(server).post("/api/settings");
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("ACCEPTED");
  });
});
