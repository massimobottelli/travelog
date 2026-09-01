/**
 * Travelog MVP1 — Trip operations domain rules (Phase 6)
 *
 * Pure rules for the manual trip operations (functional requirements
 * §13, §14): split and merge. ISO calendar dates (YYYY-MM-DD) compare
 * lexicographically, so plain string comparison is chronologically
 * correct.
 */

import type { TripInterval } from "./trip-rules.js";

/**
 * The split date belongs to the second trip (§13.3): it must be strictly
 * after the trip start (otherwise the first trip would be empty) and at
 * most the trip end (otherwise the second trip would be empty).
 */
export function isValidSplitDate(startDate: string, endDate: string, splitDate: string): boolean {
  return splitDate > startDate && splitDate <= endDate;
}

/**
 * Resulting intervals of a split: the original trip covers
 * [start, splitDate-1] and the new trip covers [splitDate, end].
 */
export function computeSplitIntervals(
  startDate: string,
  endDate: string,
  splitDate: string,
): [TripInterval, TripInterval] {
  return [
    { startDate, endDate: splitDate === startDate ? startDate : previousDay(splitDate) },
    { startDate: splitDate, endDate },
  ];
}

/** The calendar day before the given ISO date. */
function previousDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d) / 86_400_000 - 1;
  return new Date(utc * 86_400_000).toISOString().slice(0, 10);
}

/**
 * System-proposed name for the second trip created by a split (§13.3):
 * the user can change it before confirming.
 */
export function proposeSplitTripName(originalName: string): string {
  return `${originalName} (2)`;
}

/**
 * Interval of the trip resulting from a merge (§13.4): it spans the
 * earliest start and the latest end of the merged trips.
 */
export function computeMergeInterval(intervals: TripInterval[]): TripInterval {
  let startDate = intervals[0].startDate;
  let endDate = intervals[0].endDate;
  for (const interval of intervals.slice(1)) {
    if (interval.startDate < startDate) startDate = interval.startDate;
    if (interval.endDate > endDate) endDate = interval.endDate;
  }
  return { startDate, endDate };
}
