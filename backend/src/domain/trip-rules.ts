/**
 * Travelog MVP1 — Trip domain rules (Phase 5)
 *
 * Pure domain functions implementing the functional requirements:
 * - §7  giorni e aggregazione geografica
 * - §8  soglia minima per una visita
 * - §9  zone di esclusione (giornata mista / completamente esclusa)
 * - §10 generazione automatica dei viaggi
 * - §11 immutabilità dei viaggi esistenti
 *
 * All dates are naive calendar dates in ISO format YYYY-MM-DD
 * (EXIF DateTimeOriginal is naive local time — no timezone conversion,
 * requirements §5.2/§18). Day arithmetic uses UTC so the results are
 * independent from the server timezone.
 */

export type DayKind = "travel" | "excluded" | "no_visit";

export interface DayFacts {
  /** Naive calendar date, YYYY-MM-DD. */
  date: string;
  /** Valid geolocated photos outside every exclusion zone. */
  photosOutsideZone: number;
  /** Valid geolocated photos inside an exclusion zone. */
  photosInsideZone: number;
  /** Out-of-zone presences (day + locality) meeting the visit threshold. */
  outOfZoneVisits: number;
}

export interface DayClassification {
  date: string;
  kind: DayKind;
}

export interface TripInterval {
  /** Inclusive start date, YYYY-MM-DD. */
  startDate: string;
  /** Inclusive end date, YYYY-MM-DD. */
  endDate: string;
}

function toUtcDay(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

function fromUtcDay(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (positive when b is after a). */
export function diffInDays(a: string, b: string): number {
  return toUtcDay(b) - toUtcDay(a);
}

/** Shift a naive ISO date by a number of days. */
export function addDays(date: string, days: number): string {
  const utc = toUtcDay(date) + days;
  return new Date(utc * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Classify a single calendar day (requirements §9.4, §9.5, §10.2):
 *
 * - "travel": at least one out-of-zone visit (a day + locality presence
 *   meeting the minimum-photos-per-visit threshold);
 * - "excluded": photos exist but exclusively inside exclusion zones —
 *   an ongoing trip closes immediately at the previous day (§9.5);
 * - "no_visit": no qualifying presence (no photos at all, or photos only
 *   below the visit threshold) — counts toward the days-without-photos
 *   tolerance (§10.3).
 */
export function classifyDay(facts: DayFacts): DayClassification {
  if (facts.outOfZoneVisits > 0) {
    return { date: facts.date, kind: "travel" };
  }
  if (facts.photosInsideZone > 0 && facts.photosOutsideZone === 0) {
    return { date: facts.date, kind: "excluded" };
  }
  return { date: facts.date, kind: "no_visit" };
}

/**
 * Group classified days into trip intervals (requirements §10).
 *
 * - A trip starts at the first travel day and is extended by any
 *   subsequent travel day, regardless of locality changes (§10.1);
 * - a gap of `maxGapDays` (or more) consecutive days without visits
 *   closes the trip before the next travel day starts a new one (§10.3);
 * - a fully excluded day closes the trip immediately (§9.5);
 * - the trip end date is always the last travel day belonging to it —
 *   days without photos used to detect closure are never included (§10.5).
 *
 * Days are sorted internally, so the caller may pass them in any order.
 * Days absent from the list are treated as days without visits.
 */
export function groupDaysIntoTrips(days: DayClassification[], maxGapDays: number): TripInterval[] {
  const trips: TripInterval[] = [];
  let current: TripInterval | null = null;

  // diffInDays(a, b) is positive when b is after a, so the ascending
  // comparator must invert the arguments.
  const sorted = [...days].sort((a, b) => diffInDays(b.date, a.date));
  for (const day of sorted) {
    if (day.kind === "travel") {
      if (current) {
        const gap = diffInDays(current.endDate, day.date) - 1;
        if (gap >= maxGapDays) {
          trips.push(current);
          current = { startDate: day.date, endDate: day.date };
        } else {
          current.endDate = day.date;
        }
      } else {
        current = { startDate: day.date, endDate: day.date };
      }
    } else if (day.kind === "excluded" && current) {
      // §9.5: return home / fully excluded day closes the trip immediately
      // at the last valid out-of-zone photo day (current.endDate).
      trips.push(current);
      current = null;
    }
    // "no_visit" days neither extend nor close a trip: the gap rule is
    // evaluated when the next travel day is observed.
  }
  if (current) {
    trips.push(current);
  }
  return trips;
}

/**
 * Subtract blocked intervals (existing active trips, which must never be
 * modified automatically — requirements §10.6, §11, §21.11) from candidate
 * intervals, returning the remaining sub-intervals.
 *
 * This is what allows new photos to generate NEW trips even when they are
 * temporally contiguous to (or surround) existing trips: each remaining
 * contiguous segment becomes an independent new trip.
 */
export function clipIntervalsAgainstBlocked(
  candidates: TripInterval[],
  blocked: TripInterval[],
): TripInterval[] {
  const sortedBlocked = [...blocked]
    .map((b) => ({ start: toUtcDay(b.startDate), end: toUtcDay(b.endDate) }))
    .sort((a, b) => a.start - b.start);
  const result: TripInterval[] = [];

  for (const candidate of candidates) {
    let start = toUtcDay(candidate.startDate);
    const end = toUtcDay(candidate.endDate);

    for (const b of sortedBlocked) {
      if (b.end < start) {
        // blocked interval entirely before the remaining candidate part
        continue;
      }
      if (b.start > end) {
        // blocked interval entirely after the candidate
        break;
      }
      // Overlap: emit the part of the candidate before the blocked interval
      if (b.start > start) {
        result.push({
          startDate: fromUtcDay(start),
          endDate: fromUtcDay(b.start - 1),
        });
      }
      if (b.end >= end) {
        // Candidate fully covered by this blocked interval
        start = -1;
        break;
      }
      start = b.end + 1;
    }
    if (start >= 0 && start <= end) {
      result.push({ startDate: fromUtcDay(start), endDate: fromUtcDay(end) });
    }
  }
  return result;
}

/**
 * Default name for an auto-generated trip. The user can rename it
 * manually afterwards (requirements §13.1). The requirements do not
 * prescribe a format: a locale-independent ISO date is used.
 */
export function formatAutoTripName(startDate: string): string {
  return `Viaggio ${startDate}`;
}
