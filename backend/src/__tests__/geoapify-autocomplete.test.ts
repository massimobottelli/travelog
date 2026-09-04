/**
 * Travelog MVP1 — Geoapify Autocomplete Client (unit tests)
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  GeoapifyAutocomplete,
  mapGeoapifyPlace,
} from "../infrastructure/geocoder/geoapify-autocomplete.js";

describe("mapGeoapifyPlace", () => {
  it("prefers the administrative unit name over the generic name", () => {
    const mapped = mapGeoapifyPlace({
      place_id: "abc123",
      name: "Verona",
      city: "Verona",
      county: "Verona",
      state: "Veneto",
      country: "Italy",
      country_code: "it",
      result_type: "city",
      lat: 45.4384,
      lon: 10.9916,
    });
    expect(mapped).toEqual({
      placeId: "abc123",
      name: "Verona",
      countryCode: "IT",
      county: "Verona",
      region: "Veneto",
      country: "Italy",
      resultType: "city",
      lat: 45.4384,
      lon: 10.9916,
    });
  });

  it("falls back to name when no city/town/village is present", () => {
    const mapped = mapGeoapifyPlace({ place_id: "x1", name: "Lombardy" });
    expect(mapped?.name).toBe("Lombardy");
  });

  it("returns null without a place id or a name", () => {
    expect(mapGeoapifyPlace({ name: "X" })).toBeNull();
    expect(mapGeoapifyPlace({ place_id: "x" })).toBeNull();
  });
});

describe("GeoapifyAutocomplete", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the autocomplete API and maps the features", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      expect(String(url)).toContain("https://api.geoapify.com/v1/geocode/autocomplete");
      expect(String(url)).toContain("text=Verona");
      return new Response(
        JSON.stringify({
          features: [
            {
              properties: {
                place_id: "p1",
                city: "Verona",
                country_code: "it",
                county: "Verona",
                state: "Veneto",
                lat: 45.44,
                lon: 10.99,
              },
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = new GeoapifyAutocomplete("test-key");
    const items = await client.autocomplete("Verona", 10);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ placeId: "p1", name: "Verona", countryCode: "IT" });
  });

  it("resolves a place by id", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      expect(String(url)).toContain("id=p2");
      return new Response(
        JSON.stringify({
          features: [
            {
              properties: {
                place_id: "p2",
                city: "Siena",
                country_code: "IT",
                county: "Siena",
                state: "Tuscany",
                lat: 43.3186,
                lon: 11.3306,
              },
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = new GeoapifyAutocomplete("test-key");
    const place = await client.resolvePlace("p2");
    expect(place?.name).toBe("Siena");
  });

  it("throws on HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("err", { status: 401 })) as unknown as typeof fetch,
    );
    const client = new GeoapifyAutocomplete("bad-key");
    await expect(client.autocomplete("Verona", 10)).rejects.toThrow(/HTTP 401/);
  });
});
