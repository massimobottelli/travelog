/**
 * Travelog MVP — Trip CSV export helpers
 *
 * Pure functions building the trip export CSV (one row per
 * trip × day × locality, the trip columns repeated on every row so the
 * file is filterable/pivotable in a spreadsheet):
 *
 * Anno;Mese;Data inizio;Data fine;Nome viaggio;Durata giorni;
 * Data giorno;Localita;Foto;Note
 *
 * The locality hierarchy is a single column with the levels joined by
 * commas (Località, Provincia, Regione, Paese). Days without photos
 * (gaps of 1–2 days, §16) are exported with an empty locality and the
 * "Nessuna foto" note.
 *
 * All dates are naive ISO strings (YYYY-MM-DD); all arithmetic is
 * timezone-independent.
 */

import { diffInDays } from "../domain/trip-rules.js";
import { buildCsv } from "./csv.js";

const CSV_HEADER = [
  "Anno",
  "Mese",
  "Data inizio",
  "Data fine",
  "Nome viaggio",
  "Durata giorni",
  "Data giorno",
  "Localita",
  "Foto",
  "Note",
];

const ITALIAN_MONTHS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

export interface CsvTripLocality {
  name: string;
  county: string | null;
  region: string | null;
  country: string | null;
  photoCount: number;
}

export interface CsvTripDay {
  date: string;
  noPhotos: boolean;
  localities: CsvTripLocality[];
  /** True when the day was created manually by the user. */
  manual?: boolean;
}

export interface CsvTrip {
  name: string;
  /** Naive ISO date, YYYY-MM-DD. */
  startDate: string;
  /** Naive ISO date, YYYY-MM-DD. */
  endDate: string;
  days: CsvTripDay[];
}

/** Year component of a naive ISO date. */
export function tripYear(isoDate: string): string {
  return isoDate.slice(0, 4);
}

/** Italian month name derived from a naive ISO date. */
export function tripMonth(isoDate: string): string {
  const month = Number(isoDate.slice(5, 7));
  return ITALIAN_MONTHS[month - 1] ?? "";
}

/** Inclusive duration in days of the trip interval. */
export function tripDurationDays(startDate: string, endDate: string): number {
  return diffInDays(startDate, endDate) + 1;
}

/**
 * Locality hierarchy in a single column: the non-empty levels joined by
 * commas (e.g. "Erice, Trapani, Sicily, Italy"). Missing levels are
 * omitted.
 */
export function formatLocalityHierarchy(loc: CsvTripLocality): string {
  return [loc.name, loc.county, loc.region, loc.country]
    .map((level) => level?.trim())
    .filter((level): level is string => Boolean(level))
    .join(", ");
}

/** Serialize the full export: header + one row per trip × day × locality. */
export function buildTripsCsv(trips: CsvTrip[]): string {
  const rows: string[][] = [CSV_HEADER];
  for (const trip of trips) {
    const year = tripYear(trip.startDate);
    const month = tripMonth(trip.startDate);
    const duration = String(tripDurationDays(trip.startDate, trip.endDate));
    const tripColumns = [year, month, trip.startDate, trip.endDate, trip.name, duration];

    if (trip.days.length === 0) {
      rows.push([...tripColumns, "", "", "", ""]);
      continue;
    }

    for (const day of trip.days) {
      if (day.noPhotos || day.localities.length === 0) {
        const note = day.noPhotos
          ? "Nessuna foto"
          : day.manual
            ? "Giorno senza località"
            : "Nessuna foto";
        rows.push([...tripColumns, day.date, "", "0", note]);
        continue;
      }
      for (const loc of day.localities) {
        rows.push([
          ...tripColumns,
          day.date,
          formatLocalityHierarchy(loc),
          String(loc.photoCount),
          "",
        ]);
      }
    }
  }
  return buildCsv(rows);
}
