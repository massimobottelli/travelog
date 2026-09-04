/**
 * Travelog MVP1 — Localities Autocomplete Integration Tests
 *
 * Global exclusion-zone search via the Geoapify Address Autocomplete API
 * (backend proxy). Geoapify HTTP calls are stubbed; the locality upsert
 * is verified against the real PostgreSQL test database.
 */

import { describe, it, expect, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { pool } from "../db/client.js";

const server = createApp();

const PLACE_ID = "51af1266VeronaTest";
const CLEANUP_HASH = "45.44:10.99";

function geoapifyResponse(properties: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ features: [{ properties }] }), { status: 200 });
}

const VERONA_PROPS = {
  place_id: PLACE_ID,
  city: "Verona",
  country_code: "it",
  county: "Verona",
  state: "Veneto",
  country: "Italy",
  lat: 45.4384,
  lon: 10.9916,
  result_type: "city",
};

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await pool.query(`DELETE FROM localities WHERE locality_hash = $1`, [CLEANUP_HASH]);
  await pool.end();
});

describe("GET /api/localities/autocomplete", () => {
  it("returns 400 without a query", async () => {
    process.env.GEOCOAPIFY_API_KEY = process.env.GEOCOAPIFY_API_KEY ?? "test-key";
    const res = await request(server).get("/api/localities/autocomplete");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 503 when the Geoapify API key is not configured", async () => {
    const previous = process.env.GEOCOAPIFY_API_KEY;
    delete process.env.GEOCOAPIFY_API_KEY;
    try {
      const res = await request(server).get("/api/localities/autocomplete?q=Verona");
      expect(res.status).toBe(503);
      expect(res.body.code).toBe("GEOAPIFY_NOT_CONFIGURED");
    } finally {
      process.env.GEOCOAPIFY_API_KEY = previous;
    }
  });

  it("proxies the search to Geoapify and returns suggestions", async () => {
    const fetchMock = vi.fn(async (_url: string | URL) => geoapifyResponse(VERONA_PROPS));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    process.env.GEOCOAPIFY_API_KEY = "test-key";

    const res = await request(server).get("/api/localities/autocomplete?q=Verona");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      placeId: PLACE_ID,
      name: "Verona",
      countryCode: "IT",
      region: "Veneto",
    });
    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(calledUrl).toContain("text=Verona");
  });
});

describe("POST /api/localities/resolve", () => {
  it("requires placeId", async () => {
    process.env.GEOCOAPIFY_API_KEY = "test-key";
    const res = await request(server).post("/api/localities/resolve").send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("resolves a place into a persisted locality (idempotent)", async () => {
    const fetchMock = vi.fn(async (_url: string | URL) => geoapifyResponse(VERONA_PROPS));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    process.env.GEOCOAPIFY_API_KEY = "test-key";

    const first = await request(server).post("/api/localities/resolve").send({ placeId: PLACE_ID });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      name: "Verona",
      countryCode: "IT",
      localityHash: CLEANUP_HASH,
      source: "geoapify-autocomplete",
      county: "Verona",
      region: "Veneto",
      country: "Italy",
    });
    expect(first.body.id).toBeGreaterThan(0);

    // Same place again → same locality row (upsert by hash), no duplicate
    const second = await request(server)
      .post("/api/localities/resolve")
      .send({ placeId: PLACE_ID });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);

    const { rows } = await pool.query(`SELECT id FROM localities WHERE locality_hash = $1`, [
      CLEANUP_HASH,
    ]);
    expect(rows).toHaveLength(1);
  });

  it("returns 404 when Geoapify does not know the place", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ features: [] }), { status: 200 }),
      ) as unknown as typeof fetch,
    );
    process.env.GEOCOAPIFY_API_KEY = "test-key";

    const res = await request(server).post("/api/localities/resolve").send({ placeId: "nope" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PLACE_NOT_FOUND");
  });
});
