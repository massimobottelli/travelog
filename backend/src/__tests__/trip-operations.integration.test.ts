/**
 * Travelog MVP1 — Trip operations integration tests (Phase 6)
 *
 * Uses the real PostgreSQL test database (travelog_test).
 * Covers the manual operations through the API: rename, date change,
 * overlap validation, split, merge, audit trail, trip detail with
 * days/localities and "Nessuna foto" gaps (requirements §13, §14, §16).
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { pool } from "../db/client.js";
import { createApp } from "../app.js";

const server = createApp();

// ── Fixtures ─────────────────────────────────────────────────

async function insertTrip(name: string, startDate: string, endDate: string): Promise<number> {
  const res = await pool.query(
    `INSERT INTO trips (name, start_date, end_date, auto_generated, status)
     VALUES ($1, $2::date, $3::date, true, 'active') RETURNING id`,
    [name, startDate, endDate],
  );
  return Number(res.rows[0].id);
}

async function getTripStatus(id: number): Promise<string> {
  const res = await pool.query(`SELECT status FROM trips WHERE id = $1`, [id]);
  return res.rows[0]?.status ?? "missing";
}

async function insertPresenceData(): Promise<void> {
  // Erice on 08-10 and 08-13, Milano on 08-13: trip days with localities
  const erice = await pool.query(
    `INSERT INTO localities (locality_hash, country_code, name, admin_level, county, region, country)
     VALUES ('ops-test-erice', 'IT', 'Erice', 8, 'Trapani', 'Sicily', 'Italy') RETURNING id`,
  );
  const milano = await pool.query(
    `INSERT INTO localities (locality_hash, country_code, name, admin_level, county, region, country)
     VALUES ('ops-test-milano', 'IT', 'Milano', 8, 'Milano', 'Lombardia', 'Italy') RETURNING id`,
  );
  const ericeId = Number(erice.rows[0].id);
  const milanoId = Number(milano.rows[0].id);
  await pool.query(
    `INSERT INTO presences (photo_date, locality_id, photo_count) VALUES
       ('2025-08-10', $1, 3),
       ('2025-08-13', $1, 1),
       ('2025-08-13', $2, 2)`,
    [ericeId, milanoId],
  );
}

// ── Cleanup ──────────────────────────────────────────────────

async function cleanup() {
  await pool.query("DELETE FROM photos WHERE file_path LIKE 'ops-test/%'");
  await pool.query("DELETE FROM exclusion_zones");
  await pool.query("TRUNCATE presences RESTART IDENTITY");
  await pool.query(
    "TRUNCATE trips, trip_history, manual_trip_days, manual_trip_day_localities RESTART IDENTITY",
  );
  await pool.query("DELETE FROM geocoding_cache WHERE locality_hash LIKE 'ops-test-%'");
  await pool.query("DELETE FROM localities WHERE locality_hash LIKE 'ops-test-%'");
}

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

// ── Tests ────────────────────────────────────────────────────

describe("rename and date change (§13.1, §13.2)", () => {
  it("renames a trip", async () => {
    const id = await insertTrip("Viaggio vecchio", "2025-08-10", "2025-08-13");
    const res = await request(server)
      .patch(`/api/trips/${id}`)
      .send({ name: "Vacanza in Toscana" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Vacanza in Toscana");
    expect(res.body.startDate).toBe("2025-08-10");
    expect(res.body.endDate).toBe("2025-08-13");
  });

  it("blocks overlapping date changes (§13.2, §21.17)", async () => {
    await insertTrip("A", "2025-08-01", "2025-08-05");
    const b = await insertTrip("B", "2025-08-10", "2025-08-14");
    const res = await request(server)
      .patch(`/api/trips/${b}`)
      .send({ startDate: "2025-08-04", endDate: "2025-08-14" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("TRIP_OVERLAP");
  });

  it("rejects an end date before the start date", async () => {
    const id = await insertTrip("A", "2025-08-10", "2025-08-14");
    const res = await request(server)
      .patch(`/api/trips/${id}`)
      .send({ startDate: "2025-08-14", endDate: "2025-08-10" });
    expect(res.status).toBe(400);
  });

  it("allows a date change that does not overlap", async () => {
    await insertTrip("A", "2025-08-01", "2025-08-05");
    const b = await insertTrip("B", "2025-08-10", "2025-08-14");
    const res = await request(server)
      .patch(`/api/trips/${b}`)
      .send({ startDate: "2025-08-06", endDate: "2025-08-08" });
    expect(res.status).toBe(200);
    expect(res.body.startDate).toBe("2025-08-06");
    expect(res.body.endDate).toBe("2025-08-08");
  });
});

describe("split (§13.3)", () => {
  it("splits at the requested date: it belongs to the second trip", async () => {
    const id = await insertTrip("Vacanza in Toscana", "2025-08-10", "2025-08-17");
    const res = await request(server)
      .post(`/api/trips/${id}/split`)
      .send({ splitDate: "2025-08-14" });
    expect(res.status).toBe(200);

    // Original archived, not deleted (§13.3/§14)
    expect(await getTripStatus(id)).toBe("archived");

    const [first, second] = res.body.trips;
    expect(first).toMatchObject({
      name: "Vacanza in Toscana",
      startDate: "2025-08-10",
      endDate: "2025-08-13",
      status: "active",
    });
    expect(second).toMatchObject({
      name: "Vacanza in Toscana (2)",
      startDate: "2025-08-14",
      endDate: "2025-08-17",
      status: "active",
    });

    expect(res.body.operation).toMatchObject({
      type: "SPLIT",
      sourceTripIds: [id],
      resultingTripIds: [first.id, second.id],
    });

    // Audit trail recorded (§14)
    const history = await pool.query(
      `SELECT operation, original_trip_ids, result_trip_ids FROM trip_history`,
    );
    expect(history.rows).toHaveLength(1);
    expect(history.rows[0].operation).toBe("split");
    expect(history.rows[0].original_trip_ids).toEqual([id]);
  });

  it("accepts a custom name for the second trip", async () => {
    const id = await insertTrip("A", "2025-08-10", "2025-08-17");
    const res = await request(server)
      .post(`/api/trips/${id}/split`)
      .send({ splitDate: "2025-08-14", name: "Seconda settimana" });
    expect(res.status).toBe(200);
    expect(res.body.trips[1].name).toBe("Seconda settimana");
  });

  it("rejects a split date outside the trip", async () => {
    const id = await insertTrip("A", "2025-08-10", "2025-08-17");
    const res = await request(server)
      .post(`/api/trips/${id}/split`)
      .send({ splitDate: "2025-08-10" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a missing trip", async () => {
    const res = await request(server)
      .post(`/api/trips/99999/split`)
      .send({ splitDate: "2025-08-14" });
    expect(res.status).toBe(404);
  });
});

describe("delete trip (user request)", () => {
  it("deletes an active trip and records the audit trail with a snapshot", async () => {
    const id = await insertTrip("Falso positivo", "2025-08-01", "2025-08-09");
    const res = await request(server).delete(`/api/trips/${id}`);
    expect(res.status).toBe(204);

    // The trip is gone
    const trips = await pool.query(`SELECT count(*)::int AS n FROM trips WHERE id = $1`, [id]);
    expect(trips.rows[0].n).toBe(0);

    // The audit trail survives the delete, with a snapshot of the trip
    const history = await pool.query(
      `SELECT operation, original_trip_ids, result_trip_ids, details FROM trip_history`,
    );
    expect(history.rows).toHaveLength(1);
    expect(history.rows[0].operation).toBe("delete");
    expect(history.rows[0].original_trip_ids).toEqual([id]);
    expect(history.rows[0].details).toMatchObject({
      name: "Falso positivo",
      startDate: "2025-08-01",
      endDate: "2025-08-09",
    });
  });

  it("appears in the operations list as DELETE", async () => {
    const id = await insertTrip("A", "2025-08-01", "2025-08-02");
    await request(server).delete(`/api/trips/${id}`);
    const res = await request(server).get(`/api/operations`);
    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({ type: "DELETE", sourceTripIds: [id] });
  });

  it("returns 404 for a missing trip", async () => {
    const res = await request(server).delete(`/api/trips/99999`);
    expect(res.status).toBe(404);
  });
});

describe("merge (§13.4)", () => {
  it("merges two trips: default name from the first selected trip", async () => {
    const a = await insertTrip("Primo viaggio", "2025-08-10", "2025-08-11");
    const b = await insertTrip("Secondo viaggio", "2025-08-12", "2025-08-13");

    const res = await request(server)
      .post(`/api/trips/merge`)
      .send({ tripIds: [a, b] });
    expect(res.status).toBe(200);

    // Originals archived, not deleted (§13.4/§14)
    expect(await getTripStatus(a)).toBe("archived");
    expect(await getTripStatus(b)).toBe("archived");

    const merged = res.body.trips[0];
    expect(merged).toMatchObject({
      name: "Primo viaggio",
      startDate: "2025-08-10",
      endDate: "2025-08-13",
      status: "active",
    });
    expect(res.body.operation).toMatchObject({
      type: "MERGE",
      sourceTripIds: [a, b],
      resultingTripIds: [merged.id],
    });
  });

  it("uses the provided title when merging", async () => {
    const a = await insertTrip("A", "2025-08-10", "2025-08-11");
    const b = await insertTrip("B", "2025-08-12", "2025-08-13");
    const res = await request(server)
      .post(`/api/trips/merge`)
      .send({ tripIds: [a, b], title: "Vacanza unita" });
    expect(res.status).toBe(200);
    expect(res.body.trips[0].name).toBe("Vacanza unita");
  });

  it("rejects a merge whose result would overlap another active trip", async () => {
    await insertTrip("Ostacolo", "2025-08-12", "2025-08-20");
    const a = await insertTrip("A", "2025-08-01", "2025-08-05");
    const b = await insertTrip("B", "2025-08-10", "2025-08-14");
    const res = await request(server)
      .post(`/api/trips/merge`)
      .send({ tripIds: [a, b] });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("TRIP_OVERLAP");
  });

  it("rejects merging archived trips", async () => {
    const a = await insertTrip("A", "2025-08-01", "2025-08-05");
    await pool.query(`UPDATE trips SET status = 'archived' WHERE id = $1`, [a]);
    const b = await insertTrip("B", "2025-08-10", "2025-08-11");
    const res = await request(server)
      .post(`/api/trips/merge`)
      .send({ tripIds: [a, b] });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("TRIP_NOT_ACTIVE");
  });
});

describe("operations audit trail (§14)", () => {
  it("lists the recorded operations", async () => {
    const a = await insertTrip("A", "2025-08-10", "2025-08-17");
    await request(server).post(`/api/trips/${a}/split`).send({ splitDate: "2025-08-14" });

    const res = await request(server).get(`/api/operations`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({ type: "SPLIT", sourceTripIds: [a] });
  });
});

describe("trip detail (§16)", () => {
  it("returns the chronology of days with localities and photo counts", async () => {
    await insertPresenceData();
    const id = await insertTrip("Viaggio", "2025-08-10", "2025-08-13");

    const res = await request(server).get(`/api/trips/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.days).toEqual([
      {
        date: "2025-08-10",
        noPhotos: false,
        manual: false,
        localities: [
          {
            localityId: expect.any(Number),
            name: "Erice",
            county: "Trapani",
            region: "Sicily",
            country: "Italy",
            photoCount: 3,
            manual: false,
          },
        ],
      },
      // §16: days without photos are listed with the "Nessuna foto" marker
      { date: "2025-08-11", noPhotos: true, localities: [], manual: false },
      { date: "2025-08-12", noPhotos: true, localities: [], manual: false },
      {
        date: "2025-08-13",
        noPhotos: false,
        manual: false,
        // Same-day localities are ordered by earliest photo time (§7.2):
        // these fixture presences have no photos, so the stable fallback
        // (alphabetical) applies: Erice before Milano.
        localities: [
          expect.objectContaining({ name: "Erice", photoCount: 1 }),
          expect.objectContaining({ name: "Milano", photoCount: 2 }),
        ],
      },
    ]);
  });

  it("aggregates duplicate locality rows with the same name into one entry", async () => {
    // "Erice" exists under two coordinate hashes: the detail must show a
    // single row with the summed photo count.
    const e1 = await pool.query(
      `INSERT INTO localities (locality_hash, country_code, name, admin_level, county, region, country)
       VALUES ('ops-test-erice', 'IT', 'Erice', 8, 'Trapani', 'Sicily', 'Italy') RETURNING id`,
    );
    const e2 = await pool.query(
      `INSERT INTO localities (locality_hash, country_code, name, admin_level, county, region, country)
       VALUES ('ops-test-erice2', 'IT', 'Erice', 8, 'Trapani', 'Sicily', 'Italy') RETURNING id`,
    );
    const id1 = Number(e1.rows[0].id);
    const id2 = Number(e2.rows[0].id);
    await pool.query(
      `INSERT INTO presences (photo_date, locality_id, photo_count) VALUES
         ('2025-08-15', $1, 6),
         ('2025-08-15', $2, 3)`,
      [id1, id2],
    );
    const id = await insertTrip("Viaggio", "2025-08-15", "2025-08-15");

    const res = await request(server).get(`/api/trips/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(1);
    expect(res.body.days[0].localities).toHaveLength(1);
    expect(res.body.days[0].localities[0]).toMatchObject({
      name: "Erice",
      county: "Trapani",
      photoCount: 9,
    });
  });

  it("returns 404 for a missing trip", async () => {
    const res = await request(server).get(`/api/trips/99999`);
    expect(res.status).toBe(404);
  });
});

describe("trip list default (§15)", () => {
  it("returns only active trips by default and archived on request", async () => {
    const a = await insertTrip("A", "2025-08-01", "2025-08-05");
    await insertTrip("B", "2025-08-10", "2025-08-14");
    await request(server).post(`/api/trips/${a}/split`).send({ splitDate: "2025-08-03" });

    const active = await request(server).get(`/api/trips`);
    expect(active.status).toBe(200);
    expect(active.body.items.every((t: { status: string }) => t.status === "active")).toBe(true);

    const archived = await request(server).get(`/api/trips?status=archived`);
    expect(archived.body.items.length).toBe(1);
    expect(archived.body.items[0].id).toBe(a);
  });
});
