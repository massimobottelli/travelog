/**
 * Travelog MVP1 — normalizeManualDays unit tests
 *
 * Validation of the manual day list (manual trip creation): date
 * format, duplicate dates merged, no duplicate (date, locality)
 * pairs, days allowed without localities, sorted deterministic output.
 */

import { describe, it, expect } from "vitest";
import { normalizeManualDays } from "../../services/trips.service.js";
import { ValidationError } from "../../models/errors.js";

describe("normalizeManualDays", () => {
  it("accepts valid days and returns sorted days", () => {
    const days = normalizeManualDays([
      { date: "2025-08-12", localityIds: [2] },
      { date: "2025-08-10", localityIds: [1, 3] },
    ]);
    expect(days).toEqual([
      { dayDate: "2025-08-10", localityIds: [1, 3] },
      { dayDate: "2025-08-12", localityIds: [2] },
    ]);
  });

  it("allows days without localities (workflow: day added first)", () => {
    const days = normalizeManualDays([{ date: "2025-08-10" }]);
    expect(days).toEqual([{ dayDate: "2025-08-10", localityIds: [] }]);
  });

  it("deduplicates repeated (date, locality) pairs", () => {
    const days = normalizeManualDays([
      { date: "2025-08-10", localityIds: [1] },
      { date: "2025-08-10", localityIds: [2, 1] },
    ]);
    expect(days).toEqual([{ dayDate: "2025-08-10", localityIds: [1, 2] }]);
  });

  it("rejects an empty list", () => {
    expect(() => normalizeManualDays([])).toThrow(ValidationError);
  });

  it("rejects invalid dates", () => {
    expect(() => normalizeManualDays([{ date: "2025-13-40", localityIds: [1] }])).toThrow(
      ValidationError,
    );
    expect(() => normalizeManualDays([{ date: "not-a-date", localityIds: [1] }])).toThrow(
      ValidationError,
    );
  });

  it("rejects invalid locality ids", () => {
    expect(() => normalizeManualDays([{ date: "2025-08-10", localityIds: [0] }])).toThrow(
      ValidationError,
    );
  });
});
