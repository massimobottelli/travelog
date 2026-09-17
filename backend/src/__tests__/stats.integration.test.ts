import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { pool } from "../db/client.js";
import { createApp } from "../app.js";

const app = createApp();
async function cleanup() {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/travelog_test") {
    throw new Error("Statistics integration tests require travelog_test");
  }
  await pool.query(
    "TRUNCATE trips, trip_history, manual_trip_days, manual_trip_day_localities, trip_day_exclusions RESTART IDENTITY",
  );
}
beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await pool.end();
});

async function trip(start: string, end: string, status = "active", manual = false) {
  await pool.query(
    `INSERT INTO trips (name, start_date, end_date, status, created_manually)
    VALUES ('Stats test', $1::date, $2::date, $3, $4)`,
    [start, end, status, manual],
  );
}

describe("GET /api/stats", () => {
  it("returns an empty history without active trips", async () => {
    await trip("2000-01-01", "2000-12-31", "archived");
    const response = await request(app).get("/api/stats");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ years: [] });
  });

  it("splits inclusive days across months/years and counts departures once, without photos", async () => {
    await trip("2023-12-29", "2024-01-03");
    await trip("2024-02-28", "2024-03-01", "active", true);
    await trip("2024-03-10", "2024-03-10");
    await trip("2024-01-01", "2024-12-31", "archived");
    // Hiding a detail day must not shorten the saved interval used for statistics.
    await pool.query(`INSERT INTO trip_day_exclusions (trip_id, day_date)
      SELECT id, '2024-01-02'::date FROM trips WHERE start_date = '2023-12-29'`);
    const before = await pool.query("SELECT * FROM trips ORDER BY id");
    const response = await request(app).get("/api/stats");
    expect(response.status).toBe(200);
    expect(response.body.years.slice(0, 2)).toEqual([
      { year: 2023, tripCount: 1, dayCount: 3, months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3] },
      { year: 2024, tripCount: 2, dayCount: 7, months: [3, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    ]);
    // The calendar always reaches the current year, even without trips.
    const currentYear = new Date().getFullYear();
    expect(response.body.years.at(-1)).toEqual({
      year: currentYear,
      tripCount: 0,
      dayCount: 0,
      months: Array(12).fill(0),
    });
    expect((await pool.query("SELECT * FROM trips ORDER BY id")).rows).toEqual(before.rows);
  });

  it("includes empty intervening years and all twelve months", async () => {
    await trip("2022-06-01", "2022-06-01");
    await trip("2024-06-01", "2024-06-01");
    const response = await request(app).get("/api/stats");
    expect(response.status).toBe(200);
    const years = response.body.years;
    expect(years[0]).toEqual({
      year: 2022,
      tripCount: 1,
      dayCount: 1,
      months: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    });
    expect(years[1]).toEqual({
      year: 2023,
      tripCount: 0,
      dayCount: 0,
      months: Array(12).fill(0),
    });
    expect(years[2]).toEqual({
      year: 2024,
      tripCount: 1,
      dayCount: 1,
      months: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    });
    expect(years.at(-1).year).toBe(new Date().getFullYear());
  });

  it("handles a whole leap year and a year with days but no departures", async () => {
    await trip("2023-12-31", "2025-01-01");
    const response = await request(app).get("/api/stats");
    expect(response.status).toBe(200);
    expect(response.body.years[1]).toEqual({
      year: 2024,
      tripCount: 0,
      dayCount: 366,
      months: [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    });
    expect(response.body.years[2].dayCount).toBe(1);
  });
});
