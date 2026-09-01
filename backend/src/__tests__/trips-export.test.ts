/**
 * Travelog MVP — Trip CSV export unit tests
 *
 * Pure serialization rules: header, Italian month, inclusive duration,
 * locality hierarchy in a single comma-joined column, "Nessuna foto"
 * days and CSV escaping (RFC 4180, `;` separator).
 */

import { describe, it, expect } from "vitest";
import {
  tripYear,
  tripMonth,
  tripDurationDays,
  formatLocalityHierarchy,
  buildTripsCsv,
  type CsvTrip,
} from "../utils/trips-export.js";
import { escapeCsvField, buildCsv } from "../utils/csv.js";

describe("csv utils", () => {
  it("leaves plain fields untouched", () => {
    expect(escapeCsvField("Erice")).toBe("Erice");
  });

  it("quotes fields containing the separator, quotes or newlines", () => {
    expect(escapeCsvField("a;b")).toBe('"a;b"');
    expect(escapeCsvField('a "quoted" b')).toBe('"a ""quoted"" b"');
    expect(escapeCsvField("line\nbreak")).toBe('"line\nbreak"');
  });

  it("builds rows with `;` separator and UTF-8 BOM", () => {
    const csv = buildCsv([
      ["A", "B"],
      ["C", "D"],
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe("\uFEFFA;B\r\nC;D\r\n");
  });
});

describe("trip export field derivation", () => {
  it("derives year and Italian month from the start date", () => {
    expect(tripYear("2025-08-10")).toBe("2025");
    expect(tripMonth("2025-08-10")).toBe("Agosto");
    expect(tripMonth("2026-01-03")).toBe("Gennaio");
    expect(tripMonth("2025-12-31")).toBe("Dicembre");
  });

  it("computes the inclusive duration (§15)", () => {
    expect(tripDurationDays("2025-08-10", "2025-08-10")).toBe(1);
    expect(tripDurationDays("2025-08-10", "2025-08-17")).toBe(8);
  });
});

describe("locality hierarchy column", () => {
  it("joins the non-empty levels with commas", () => {
    expect(
      formatLocalityHierarchy({
        name: "Erice",
        county: "Trapani",
        region: "Sicily",
        country: "Italy",
        photoCount: 10,
      }),
    ).toBe("Erice, Trapani, Sicily, Italy");
  });

  it("omits missing levels", () => {
    expect(
      formatLocalityHierarchy({
        name: "Italy",
        county: null,
        region: null,
        country: null,
        photoCount: 1,
      }),
    ).toBe("Italy");
  });
});

describe("buildTripsCsv", () => {
  const baseTrip: CsvTrip = {
    name: "Sicilia",
    startDate: "2025-08-10",
    endDate: "2025-08-13",
    days: [
      {
        date: "2025-08-10",
        noPhotos: false,
        localities: [
          { name: "Erice", county: "Trapani", region: "Sicily", country: "Italy", photoCount: 80 },
          {
            name: "Trapani",
            county: "Trapani",
            region: "Sicily",
            country: "Italy",
            photoCount: 35,
          },
        ],
      },
      { date: "2025-08-12", noPhotos: true, localities: [] },
      {
        date: "2025-08-13",
        noPhotos: false,
        localities: [
          {
            name: "Palermo",
            county: "Palermo",
            region: "Sicily",
            country: "Italy",
            photoCount: 120,
          },
        ],
      },
    ],
  };

  it("writes one row per trip × day × locality with trip columns repeated", () => {
    const csv = buildTripsCsv([baseTrip]);
    const lines = csv
      .replace(/^\uFEFF/, "")
      .split("\r\n")
      .filter((l: string) => l.length > 0);
    expect(lines).toHaveLength(5); // header + 2 (day 1) + 1 (gap) + 1 (day 3)
    expect(lines[0]).toBe(
      "Anno;Mese;Data inizio;Data fine;Nome viaggio;Durata giorni;Data giorno;Localita;Foto;Note",
    );
    expect(lines[1]).toBe(
      "2025;Agosto;2025-08-10;2025-08-13;Sicilia;4;2025-08-10;Erice, Trapani, Sicily, Italy;80;",
    );
    expect(lines[2]).toBe(
      "2025;Agosto;2025-08-10;2025-08-13;Sicilia;4;2025-08-10;Trapani, Trapani, Sicily, Italy;35;",
    );
    expect(lines[3]).toBe("2025;Agosto;2025-08-10;2025-08-13;Sicilia;4;2025-08-12;;0;Nessuna foto");
    expect(lines[4]).toBe(
      "2025;Agosto;2025-08-10;2025-08-13;Sicilia;4;2025-08-13;Palermo, Palermo, Sicily, Italy;120;",
    );
  });

  it("escapes trip names containing the separator", () => {
    const csv = buildTripsCsv([{ ...baseTrip, name: 'Via; boh "x"', days: [] }]);
    expect(csv).toContain('"Via; boh ""x"""');
  });

  it("exports an empty locality row for a trip without days", () => {
    const csv = buildTripsCsv([{ ...baseTrip, days: [] }]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe("2025;Agosto;2025-08-10;2025-08-13;Sicilia;4;;;;");
  });
});
