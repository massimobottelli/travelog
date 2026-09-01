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
};
