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
  // The overview snapshot must never leak between tests: every test then
  // starts with a cache miss and recomputes from the fixtures it created.
  await pool.query("TRUNCATE trips_overview_map_cache RESTART IDENTITY");
  await pool.query("DELETE FROM geocoding_cache WHERE locality_hash = ANY($1::text[])", [HASHES]);
  await pool.query("DELETE FROM localities WHERE locality_hash = ANY($1::text[])", [HASHES]);
}

// ── Tests ────────────────────────────────────────────────────

describe("GET /trips/map — panoramic overview (one marker per locality)", () => {
  it("deduplicates the same locality across multiple trips into one marker", async () => {
    const roma = await insertLocality("41.90:12.50", "Roma", "Roma", "Lazio");
    const milano = await insertLocality("45.47:9.19", "Milano", "Milano", "Lombardia");

    // Trip 1 visits Roma + Milano; trip 2 visits Roma again.
    const trip1 = await request(server)
      .post("/api/trips")
      .send({
        name: "T1",
        days: [
          { date: "2025-08-10", localityIds: [roma] },
          { date: "2025-08-11", localityIds: [milano] },
        ],
      });
    expect(trip1.status).toBe(201);
    const trip2 = await request(server)
      .post("/api/trips")
      .send({
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

    const created = await request(server)
      .post("/api/trips")
      .send({
        name: "Province",
        days: [{ date: "2025-08-10", localityIds: [alba, asti] }],
      });
    expect(created.status).toBe(201);

    const body = await getOverview();
    expect(Object.keys(body.countyColors).sort()).toEqual(["Asti", "Cuneo"]);
  });
});

describe("GET/POST /trips/map — persistent read-through cache (migration 0017)", () => {
  it("serves the cached snapshot until an explicit recalculation", async () => {
    const roma = await insertLocality("41.90:12.50", "Roma", "Roma", "Lazio");

    // First request: cache miss → computed, stored and served. The
    // fixtures create no trips yet, so the snapshot is empty but valid.
    const first = await getOverview();
    expect(first.markers).toEqual([]);
    expect(typeof first.computedAt).toBe("string");
    expect(first.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);

    // The data changes afterwards: a new trip visits Roma.
    const created = await request(server)
      .post("/api/trips")
      .send({
        name: "Dopo la snapshot",
        days: [{ date: "2025-08-10", localityIds: [roma] }],
      });
    expect(created.status).toBe(201);

    // The next GET serves the CACHED snapshot: still empty, same
    // computedAt — the aggregation is not rerun on every request.
    const second = await getOverview();
    expect(second.markers).toEqual([]);
    expect(second.computedAt).toBe(first.computedAt);

    // The explicit recalculation recomputes, overwrites the cache and
    // returns the fresh data synchronously.
    const recalculated = await request(server).post("/api/trips/map/recalculate");
    expect(recalculated.status).toBe(200);
    expect(recalculated.body.markers.map((m: { name: string }) => m.name)).toEqual(["Roma"]);
    expect(new Date(recalculated.body.computedAt as string).getTime()).toBeGreaterThanOrEqual(
      new Date(first.computedAt).getTime(),
    );

    // And the following GET serves the refreshed snapshot.
    const third = await getOverview();
    expect(third.markers.map((m: { name: string }) => m.name)).toEqual(["Roma"]);
    expect(third.computedAt).toBe(recalculated.body.computedAt);
  });

  it("recalculates from an empty cache on the first request (read-through)", async () => {
    const alba = await insertLocality("44.71:8.03", "Alba", "Cuneo", "Piemonte");
    const created = await request(server)
      .post("/api/trips")
      .send({
        name: "Read-through",
        days: [{ date: "2025-08-10", localityIds: [alba] }],
      });
    expect(created.status).toBe(201);

    // No snapshot exists (beforeEach truncates the cache): the plain GET
    // must compute and serve the data — no recalculation endpoint needed.
    const body = await getOverview();
    expect(body.markers.map((m: { name: string }) => m.name)).toEqual(["Alba"]);

    // The snapshot is now cached: verified by re-reading the table.
    const rows = await pool.query("SELECT id FROM trips_overview_map_cache WHERE id = 1");
    expect(rows.rows).toHaveLength(1);
  });
});

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});
