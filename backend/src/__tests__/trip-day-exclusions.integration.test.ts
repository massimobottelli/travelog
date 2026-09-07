/**
 * Travelog MVP — Trip day exclusions integration tests
 *
 * "Cancella giorno"/"cancella località" extended to AUTO-generated trips
 * (user request): the photo-derived days come from presences, so the
 * deletions are persisted as explicit, reversible day exclusions in
 * trip_day_exclusions (they survive re-scans/recalculation, §11), while
 * the detail (§16) and the trip map hide the excluded content.
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

async function insertLocality(hash: string, name: string): Promise<number> {
  const res = await pool.query(
    `INSERT INTO localities (locality_hash, country_code, name, admin_level, county, region, country)
     VALUES ($1, 'IT', $2, 8, 'TestCounty', 'TestRegion', 'Italy') RETURNING id`,
    [hash, name],
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

async function createAutoTripWithPhotos(): Promise<{
  tripId: number;
  erice: number;
  milano: number;
}> {
  const erice = await insertLocality("38.03:12.58", "Erice");
  const milano = await insertLocality("45.01:9.01", "Milano");
  await insertCache(38.031, 12.581, "38.03:12.58", erice);
  await insertCache(45.011, 9.011, "45.01:9.01", milano);
  await insertPhoto("excl-test/a", "2025-08-10 10:30:00", 38.031, 12.581);
  await insertPhoto("excl-test/b", "2025-08-11 09:00:00", 45.011, 9.011);
  await presencesRepository.rebuildFromPhotos();
  const trip = await tripsRepository.createAutoTrip({
    name: "Sicilia",
    startDate: "2025-08-10",
    endDate: "2025-08-11",
  });
  return { tripId: trip.id, erice, milano };
}

async function getDetail(tripId: number) {
  const res = await request(server).get(`/api/trips/${tripId}`);
  expect(res.status).toBe(200);
  return res.body;
}

async function putDays(tripId: number, days: Array<{ date: string; localityIds: number[] }>) {
  return request(server).put(`/api/trips/${tripId}/days`).send({ days });
}

// ── Cleanup ──────────────────────────────────────────────────

async function cleanup() {
  await pool.query("DELETE FROM photos WHERE file_path LIKE 'excl-test/%'");
  await pool.query("TRUNCATE presences RESTART IDENTITY");
  await pool.query(
    "TRUNCATE trips, trip_history, manual_trip_days, manual_trip_day_localities, trip_day_exclusions RESTART IDENTITY",
  );
  await pool.query(
    "DELETE FROM geocoding_cache WHERE locality_hash IN ('38.03:12.58', '45.01:9.01', '37.85:15.27')",
  );
  await pool.query(
    "DELETE FROM localities WHERE locality_hash IN ('38.03:12.58', '45.01:9.01', '37.85:15.27')",
  );
}

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

// ── Tests ────────────────────────────────────────────────────

describe("day exclusions on auto-generated trips", () => {
  it("deletes a photo-derived locality: excluded from detail and map, reversibly", async () => {
    const { tripId, erice, milano } = await createAutoTripWithPhotos();

    // Delete the Erice day card from 10/08: the request echoes the
    // remaining visible days (the panel sends the full day list).
    const res = await putDays(tripId, [{ date: "2025-08-11", localityIds: [milano] }]);
    expect(res.status).toBe(200);

    let detail = await getDetail(tripId);
    expect(detail.days.map((d: { date: string }) => d.date)).toEqual(["2025-08-11"]);
    expect(detail.startDate).toBe("2025-08-10"); // the interval does not change

    // The trip map hides the excluded locality too.
    const map = await request(server).get(`/api/trips/${tripId}/map`);
    expect(map.status).toBe(200);
    expect(map.body.markers.map((m: { name: string }) => m.name)).toEqual(["Milano"]);

    // Reversible: re-adding the excluded locality removes the exclusion.
    const res2 = await putDays(tripId, [
      { date: "2025-08-10", localityIds: [erice] },
      { date: "2025-08-11", localityIds: [milano] },
    ]);
    expect(res2.status).toBe(200);
    detail = await getDetail(tripId);
    expect(detail.days.map((d: { date: string }) => d.date)).toEqual([
      "2025-08-10",
      "2025-08-11",
    ]);
  });

  it("deletes a whole photo day (localityKey null) and persists the exclusion", async () => {
    const { tripId, milano } = await createAutoTripWithPhotos();

    const res = await putDays(tripId, [{ date: "2025-08-11", localityIds: [milano] }]);
    expect(res.status).toBe(200);
    const detail = await getDetail(tripId);
    expect(detail.days.map((d: { date: string }) => d.date)).toEqual(["2025-08-11"]);

    const exclusions = await pool.query(
      `SELECT to_char(day_date,'YYYY-MM-DD') AS d, locality_key AS k
       FROM trip_day_exclusions WHERE trip_id = $1 ORDER BY locality_key NULLS FIRST`,
      [tripId],
    );
    expect(exclusions.rows).toEqual([{ d: "2025-08-10", k: null }]);
  });

  it("rejects requested days outside the trip interval (400)", async () => {
    const { tripId, milano } = await createAutoTripWithPhotos();
    const res = await putDays(tripId, [
      { date: "2025-08-10", localityIds: [] },
      { date: "2025-08-11", localityIds: [milano] },
      { date: "2025-09-30", localityIds: [milano] },
    ]);
    expect(res.status).toBe(400);
  });

  it("adds a manual locality to an auto trip via the same endpoint", async () => {
    const { tripId, erice, milano } = await createAutoTripWithPhotos();
    const taormina = await insertLocality("37.85:15.27", "Taormina");

    const res = await putDays(tripId, [
      { date: "2025-08-10", localityIds: [erice, taormina] },
      { date: "2025-08-11", localityIds: [milano] },
    ]);
    expect(res.status).toBe(200);
    const detail = await getDetail(tripId);
    const day10 = detail.days.find((d: { date: string }) => d.date === "2025-08-10");
    expect(day10.localities.map((l: { name: string }) => l.name).sort()).toEqual([
      "Erice",
      "Taormina",
    ]);
  });
});
