/**
 * Travelog MVP1 — Shared formatting utilities
 */

/** Format a naive local-time datetime string ("YYYY-MM-DDTHH:mm:ss") for display. */
export function formatDateTime(naive: string): string {
  // Naive local time is shown as-is, without timezone conversion
  return naive.replace("T", " ");
}

/** Format GPS coordinates for display, e.g. "45.564100, 9.174200". */
export function formatCoordinates(lat: number | null, lon: number | null): string {
  if (lat === null || lon === null) {
    return "—";
  }
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

/** Format the hierarchical administrative locality, e.g. "Italy / Sicily / Trapani / Erice". */
export function formatLocality(
  locality:
    | {
        name: string;
        county?: string | null;
        region?: string | null;
        country?: string | null;
      }
    | null
    | undefined,
): string {
  if (!locality) {
    return "—";
  }
  return [locality.country, locality.region, locality.county, locality.name]
    .filter((part): part is string => Boolean(part))
    .join(" / ");
}

/** Scan status labels (Italian, per the functional requirements §4.1). */
export const SCAN_STATUS_LABELS: Record<string, string> = {
  pending: "In attesa",
  running: "In corso",
  completed: "Completata",
  completed_with_errors: "Completata con errori",
  failed: "Fallita",
  stopped: "Fermata",
};

// ── Trip formatting helpers (§15/§16) ────────────────────────

const MONTHS_IT = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

/** Shift a naive ISO date (YYYY-MM-DD) by a number of days. */
export function addDaysIso(date: string, days: number): string {
  const utc = new Date(`${date}T00:00:00Z`).getTime() / 86_400_000 + days;
  return new Date(utc * 86_400_000).toISOString().slice(0, 10);
}

/** Trip duration in days, inclusive of both ends (§15: derived from the interval). */
export function tripDurationDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Trip year, e.g. "2025". */
export function tripYear(date: string): string {
  return date.slice(0, 4);
}

/** Trip month in Italian, e.g. "agosto". */
export function tripMonth(date: string): string {
  const m = Number(date.slice(5, 7));
  return MONTHS_IT[m - 1] ?? "";
}

/** Naive ISO date formatted for display, e.g. "10/08/2025". */
export function formatTripDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}
