/**
 * Travelog MVP1 — Trip CSV export integration test
 *
 * Uses the real PostgreSQL test database (travelog_test) and verifies
 * the GET /trips/export endpoint end-to-end: content type, attachment
 * header, header row, one row per trip × day × locality, locality
 * hierarchy in a single comma-joined column and "Nessuna foto" gaps.
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { pool } from "../db/client.js";
import { createApp } from "../app.js";

const server = createApp();

async function insertTrip(name: string, startDate: string, endDate: string): Promise<number> {
  const res = await pool.query(
    `INSERT INTO trips (name, start_date, end_date, auto_generated, status)
     VALUES ($1, $2::date, $3::date, true, 'active') RETURNING id`,
    [name, startDate, endDate],
  );
  return Number(res.rows[0].id);
}

async function insertPresenceData(): Promise<void> {
  const erice = await pool.query(
    `INSERT INTO localities (locality_hash, country_code, name, admin_level, county, region, country)
     VALUES ('export-test-erice', 'IT', 'Erice', 8, 'Trapani', 'Sicily', 'Italy') RETURNING id`,
  );
  const ericeId = Number(erice.rows[0].id);
  await pool.query(
    `INSERT INTO presences (photo_date, locality_id, photo_count) VALUES
       ('2025-08-10', $1, 3),
       ('2025-08-13', $1, 1)`,
    [ericeId],
  );
}

async function cleanup() {
  await pool.query("DELETE FROM photos WHERE file_path LIKE 'export-test/%'");
  await pool.query("TRUNCATE presences RESTART IDENTITY");
  await pool.query("TRUNCATE trips, trip_history RESTART IDENTITY");
  await pool.query("DELETE FROM geocoding_cache WHERE locality_hash LIKE 'export-test-%'");
  await pool.query("DELETE FROM localities WHERE locality_hash LIKE 'export-test-%'");
}

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("GET /api/trips/export (CSV)", () => {
  it("returns a CSV attachment with trip, day and locality rows", async () => {
    await insertTrip("Sicilia", "2025-08-10", "2025-08-13");
    await insertPresenceData();

    const res = await request(server).get("/api/trips/export");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-disposition"]).toContain(".csv");

    const csv = res.text.replace(/^\uFEFF/, "");
    const lines = csv.split("\r\n").filter((l) => l.length > 0);
    expect(lines[0]).toBe(
      "Anno;Mese;Data inizio;Data fine;Nome viaggio;Durata giorni;Data giorno;Localita;Foto;Note",
    );
    expect(lines[1]).toBe(
      "2025;Agosto;2025-08-10;2025-08-13;Sicilia;4;2025-08-10;Erice, Trapani, Sicily, Italy;3;",
    );
    expect(lines[2]).toBe("2025;Agosto;2025-08-10;2025-08-13;Sicilia;4;2025-08-11;;0;Nessuna foto");
    expect(lines[3]).toBe("2025;Agosto;2025-08-10;2025-08-13;Sicilia;4;2025-08-12;;0;Nessuna foto");
    expect(lines[4]).toBe(
      "2025;Agosto;2025-08-10;2025-08-13;Sicilia;4;2025-08-13;Erice, Trapani, Sicily, Italy;1;",
    );
    expect(lines).toHaveLength(5);
  });

  it("exports only active trips", async () => {
    await insertTrip("Attivo", "2025-08-10", "2025-08-11");
    await pool.query(
      `INSERT INTO trips (name, start_date, end_date, auto_generated, status)
       VALUES ('Archiviato', '2025-09-01', '2025-09-02'::date, true, 'archived')`,
    );

    const res = await request(server).get("/api/trips/export");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Attivo");
    expect(res.text).not.toContain("Archiviato");
  });

  it("returns only the header when there are no trips", async () => {
    const res = await request(server).get("/api/trips/export");
    expect(res.status).toBe(200);
    const lines = res.text.split("\r\n").filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Anno");
  });
});
