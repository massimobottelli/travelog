/**
 * Travelog MVP1 — Trips overview map integration tests
 *
 * GET /trips/map must return exactly ONE marker per unique locality
 * (name + county + region) across all active trips — presence localities
 * within each trip's interval plus manual-day localities, deduplicated.
 * Uses the real PostgreSQL test database (travelog_test).
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { pool } from "../db/client.js";
import presencesRepository from "../repositories/presences.repository.js";
import tripsRepository from "../repositories/trips.repository.js";
import { createApp } from "../app.js";

const server = createApp();

// ── Fixtures ─────────────────────────────────────────────────

async function insertLocality(
  hash: string,
  name: string,
  county: string,
  region: string,
): Promise<number> {
  const res = await pool.query(
    `INSERT INTO localities (locality_hash, country_code, name, admin_level, county, region, country)
     VALUES ($1, 'IT', $2, 8, $3, $4, 'Italy') RETURNING id`,
    [hash, name, county, region],
  );
  return Number(res.rows[0].id);
}

async function insertCache(lat: number, lon: number, hash: string, localityId: number) {
  await pool.query(
    `INSERT INTO geocoding_cache (original_latitude, original_longitude, locality_hash, locality_id, country_code, name, admin_level, geo_applied)
     VALUES ($1, $2, $3, $4, 'IT', 'X', 8, true)`,
    [lat, lon, hash, localityId],
  );
}

async function insertPhoto(
  filePath: string,
  dateTime: string,
  lat: number,
  lon: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO photos (file_path, file_name, file_type, size, mtime, date_time_original, original_latitude, original_longitude, metadata_status)
     VALUES ($1, 'p.jpg', 'jpg', 100, 1700000000, $2, $3, $4, 'valid')`,
    [filePath, dateTime, lat, lon],
  );
}

async function getOverview() {
  const res = await request(server).get("/api/trips/map");
  expect(res.status).toBe(200);
  return res.body;
}

// Locality hashes must be coordinate pairs ("lat:lon") — the overview query
// extracts marker coordinates from them. Kept unique to this test file.
const HASHES = ["41.90:12.50", "45.47:9.19", "44.71:8.03", "44.91:8.20"];

// ── Cleanup ──────────────────────────────────────────────────

async function cleanup() {
  await pool.query("DELETE FROM photos WHERE file_path LIKE 'overview-test/%'");
  await pool.query("TRUNCATE presences RESTART IDENTITY");
  await pool.query(
    "TRUNCATE trips, trip_history, manual_trip_days, manual_trip_day_localities, trip_day_exclusions RESTART IDENTITY",
  );
  await pool.query(
    "DELETE FROM geocoding_cache WHERE locality_hash = ANY($1::text[])",
    [HASHES],
  );
  await pool.query("DELETE FROM localities WHERE locality_hash = ANY($1::text[])", [HASHES]);
}

// ── Tests ────────────────────────────────────────────────────

describe("GET /trips/map — panoramic overview (one marker per locality)", () => {
  it("deduplicates the same locality across multiple trips into one marker", async () => {
    const roma = await insertLocality("41.90:12.50", "Roma", "Roma", "Lazio");
    const milano = await insertLocality("45.47:9.19", "Milano", "Milano", "Lombardia");

    // Trip 1 visits Roma + Milano; trip 2 visits Roma again.
    const trip1 = await request(server).post("/api/trips").send({
      name: "T1",
      days: [
        { date: "2025-08-10", localityIds: [roma] },
        { date: "2025-08-11", localityIds: [milano] },
      ],
    });
    expect(trip1.status).toBe(201);
    const trip2 = await request(server).post("/api/trips").send({
      name: "T2",
      days: [{ date: "2025-09-01", localityIds: [roma] }],
    });
    expect(trip2.status).toBe(201);

    const body = await getOverview();
    const names = (body.markers as Array<{ name: string }>).map((m) => m.name).sort();
    expect(names).toEqual(["Milano", "Roma"]);
  });

  it("includes photo-presence localities across active trips with summed counts", async () => {
    const roma = await insertLocality("41.90:12.50", "Roma", "Roma", "Lazio");
    await insertCache(41.9, 12.5, "41.90:12.50", roma);
    await insertPhoto("overview-test/a", "2025-08-10 10:30:00", 41.9, 12.5);
    await insertPhoto("overview-test/b", "2025-08-11 10:30:00", 41.9, 12.5);
    await presencesRepository.rebuildFromPhotos();

    await tripsRepository.createAutoTrip({
      name: "Auto",
      startDate: "2025-08-10",
      endDate: "2025-08-11",
    });

    const body = await getOverview();
    expect(body.markers.map((m: { name: string }) => m.name)).toEqual(["Roma"]);
    // Two presences on the same locality → summed photo count.
    expect(body.markers[0].photoCount).toBe(2);
  });

  it("assigns one color per county for the legend", async () => {
    const alba = await insertLocality("44.71:8.03", "Alba", "Cuneo", "Piemonte");
    const asti = await insertLocality("44.91:8.20", "Asti", "Asti", "Piemonte");

    const created = await request(server).post("/api/trips").send({
      name: "Province",
      days: [{ date: "2025-08-10", localityIds: [alba, asti] }],
    });
    expect(created.status).toBe(201);

    const body = await getOverview();
    expect(Object.keys(body.countyColors).sort()).toEqual(["Asti", "Cuneo"]);
  });
});

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});
