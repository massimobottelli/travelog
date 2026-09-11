/**
 * Travelog MVP — Trip map integration tests
 *
 * GET /trips/:id/map must return exactly ONE waymark per locality listed
 * in the trip detail (§16): presence localities within the trip interval
 * plus the localities of the manual days, aggregated by administrative
 * name (repeated coordinate hashes of the same locality collapse into a
 * single marker with the summed photo count). Uses the real PostgreSQL
 * test database (travelog_test).
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { pool } from "../db/client.js";
import presencesRepository from "../repositories/presences.repository.js";
import tripsRepository from "../repositories/trips.repository.js";
import tripsService from "../services/trips.service.js";
import { createApp } from "../app.js";

const server = createApp();

// ── Fixtures ─────────────────────────────────────────────────

async function insertLocality(hash: string, name: string): Promise<number> {
  const res = await pool.query(
    `INSERT INTO localities (locality_hash, country_code, name, admin_level, county, region, country)
     VALUES ($1, 'IT', $2, 8, 'TestCounty', 'TestRegion', 'Italy') RETURNING id`,
    [hash, name],
  );
  return Number(res.rows[0].id);
}

async function insertLocalityWithCounty(
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

async function getMap(tripId: number) {
  const res = await request(server).get(`/api/trips/${tripId}/map`);
  expect(res.status).toBe(200);
  return res.body;
}

// ── Cleanup ──────────────────────────────────────────────────

async function cleanup() {
  await pool.query("DELETE FROM photos WHERE file_path LIKE 'map-test/%'");
  await pool.query("TRUNCATE presences RESTART IDENTITY");
  await pool.query(
    "TRUNCATE trips, trip_history, manual_trip_days, manual_trip_day_localities, trip_day_exclusions RESTART IDENTITY",
  );
  await pool.query(
    "DELETE FROM geocoding_cache WHERE locality_hash LIKE 'map-test-%' OR locality_hash IN ('38.03:12.58', '38.04:12.59', '45.46:9.19', '40.01:12.01', '45.01:9.01', '45.02:9.02', '44.70:8.03', '44.90:8.20', '44.69:7.85')",
  );
  await pool.query(
    "DELETE FROM localities WHERE locality_hash LIKE 'map-test-%' OR locality_hash IN ('38.03:12.58', '38.04:12.59', '45.46:9.19', '40.01:12.01', '45.01:9.01', '45.02:9.02', '44.70:8.03', '44.90:8.20', '44.69:7.85')",
  );
}
// ── Tests ────────────────────────────────────────────────────

describe("GET /trips/:id/map — one waymark per detail locality", () => {
  it("collapses repeated coordinate hashes of the same locality into ONE marker", async () => {
    // The same city resolved at two different rounded coordinates:
    // two `localities` rows with the same name.
    const erice1 = await insertLocality("38.03:12.58", "Erice");
    const erice2 = await insertLocality("38.04:12.59", "Erice");
    await insertCache(38.031, 12.581, "38.03:12.58", erice1);
    await insertCache(38.041, 12.591, "38.04:12.59", erice2);
    const milano = await insertLocality("45.46:9.19", "Milano");
    await insertCache(45.461, 9.191, "45.46:9.19", milano);

    await insertPhoto("map-test/a", "2025-08-10 10:30:00", 38.031, 12.581);
    await insertPhoto("map-test/b", "2025-08-11 09:00:00", 38.041, 12.591);
    await insertPhoto("map-test/c", "2025-08-12 08:00:00", 45.461, 9.191);
    await presencesRepository.rebuildFromPhotos();

    const trip = await tripsRepository.createAutoTrip({
      name: "Sicilia",
      startDate: "2025-08-10",
      endDate: "2025-08-12",
    });

    const body = await getMap(trip.id);
    expect(body.markers).toHaveLength(2);
    expect(body.markers.map((m: { name: string }) => m.name)).toEqual(["Erice", "Milano"]);
    const erice = body.markers[0];
    expect(erice.photoCount).toBe(2); // 1 + 1 across the two hash rows
    expect(erice.latitude).toBeCloseTo(38.03);
    expect(erice.longitude).toBeCloseTo(12.58);
    expect(erice.firstPhotoAt).toContain("2025-08-10");
    expect(body.markers[1].photoCount).toBe(1);
  });

  it("shows markers for manual-day localities even without any photo", async () => {
    const erice = await insertLocality("40.01:12.01", "Erice");
    const milano = await insertLocality("45.01:9.01", "Milano");
    const created = await request(server)
      .post("/api/trips")
      .send({
        name: "Manuale",
        days: [
          { date: "2025-08-10", localityIds: [erice] },
          { date: "2025-08-11", localityIds: [milano, erice] },
        ],
      });
    expect(created.status).toBe(201);
    const tripId = created.body.id as number;

    const body = await getMap(tripId);
    expect(body.markers).toHaveLength(2);
    expect(body.markers.map((m: { name: string }) => m.name)).toEqual(["Erice", "Milano"]);
    for (const m of body.markers) {
      expect(m.photoCount).toBe(0);
      expect(m.firstPhotoAt).toBeNull();
    }
  });

  it("lists manual localities alongside the photo-based presences of the same trip", async () => {
    const erice = await insertLocality("38.03:12.58", "Erice");
    await insertCache(38.031, 12.581, "38.03:12.58", erice);
    const milano = await insertLocality("45.02:9.02", "Milano");
    await insertPhoto("map-test/a", "2025-08-10 10:30:00", 38.031, 12.581);
    await presencesRepository.rebuildFromPhotos();

    const trip = await tripsRepository.createAutoTrip({
      name: "Misto",
      startDate: "2025-08-10",
      endDate: "2025-08-11",
    });
    await tripsService.replaceTripDays(trip.id, [
      { date: "2025-08-10", localityIds: [erice] },
      { date: "2025-08-11", localityIds: [milano] },
    ]);

    const body = await getMap(trip.id);
    expect(body.markers.map((m: { name: string }) => m.name)).toEqual(["Erice", "Milano"]);
    expect(body.markers[0].photoCount).toBe(1);
    expect(body.markers[1].photoCount).toBe(0);
  });

  it("assigns one color per county (province), not per region", async () => {
    // Alba and Bra are both in the province of Cuneo; Asti is a different one.
    // The locality hash must be a coordinate pair (the map query extracts the
    // marker coordinates from it).
    const alba = await insertLocalityWithCounty("44.70:8.03", "Alba", "Cuneo", "Piemonte");
    const asti = await insertLocalityWithCounty("44.90:8.20", "Asti", "Asti", "Piemonte");
    const bra = await insertLocalityWithCounty("44.69:7.85", "Bra", "Cuneo", "Piemonte");

    const created = await request(server)
      .post("/api/trips")
      .send({
        name: "Province",
        days: [
          { date: "2025-08-10", localityIds: [alba, asti] },
          { date: "2025-08-11", localityIds: [bra] },
        ],
      });
    expect(created.status).toBe(201);

    const body = await getMap(created.body.id as number);
    const byName = new Map(
      (body.markers as Array<{ name: string; countyColor: string }>).map((m) => [m.name, m]),
    );

    // Same province → same color; different province → different color.
    expect(byName.get("Alba")?.countyColor).toBe(byName.get("Bra")?.countyColor);
    expect(byName.get("Asti")?.countyColor).not.toBe(byName.get("Alba")?.countyColor);
    // The legend is keyed by county, not by region.
    expect(Object.keys(body.countyColors).sort()).toEqual(["Asti", "Cuneo"]);
    expect(body.countyColors.Cuneo).toBe(byName.get("Alba")?.countyColor);
  });
});

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});
