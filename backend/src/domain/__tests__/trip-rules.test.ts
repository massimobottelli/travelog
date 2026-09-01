/**
 * Travelog MVP1 — Trip domain rules (Phase 5) — unit tests
 *
 * Verifies the pure domain functions against the functional
 * requirements §7–§11, including the worked examples of §9.5, §10.5
 * and §10.6.
 */

import { describe, it, expect } from "vitest";
import {
  classifyTravelDays,
  groupDaysIntoTrips,
  clipIntervalsAgainstBlocked,
  formatAutoTripName,
  addDays,
  diffInDays,
  kindOfDay,
  type DayClassification,
  type DayFacts,
} from "../trip-rules.js";

function day(date: string, kind: DayClassification["kind"]): DayClassification {
  return { date, kind };
}

function facts(date: string, outside: number, inside = 0): DayFacts {
  return { date, photosOutsideZone: outside, photosInsideZone: inside };
}

describe("date helpers", () => {
  it("computes whole-day differences", () => {
    expect(diffInDays("2025-08-10", "2025-08-13")).toBe(3);
    expect(diffInDays("2025-08-13", "2025-08-10")).toBe(-3);
    expect(diffInDays("2025-08-10", "2025-08-10")).toBe(0);
  });

  it("shifts dates across month boundaries", () => {
    expect(addDays("2025-08-30", 3)).toBe("2025-09-02");
    expect(addDays("2025-01-01", -1)).toBe("2024-12-31");
    expect(addDays("2025-02-28", 1)).toBe("2025-03-01");
  });
});

describe("kindOfDay", () => {
  it("classifies a day with out-of-zone photos as out", () => {
    expect(kindOfDay({ date: "2025-08-15", photosOutsideZone: 1, photosInsideZone: 0 })).toBe(
      "out",
    );
  });

  it("classifies a mixed day (photos inside and outside exclusion) as out (§9.4)", () => {
    expect(kindOfDay({ date: "2025-08-15", photosOutsideZone: 20, photosInsideZone: 50 })).toBe(
      "out",
    );
  });

  it("classifies a fully excluded day as excluded (§9.5)", () => {
    expect(kindOfDay({ date: "2025-08-15", photosOutsideZone: 0, photosInsideZone: 50 })).toBe(
      "excluded",
    );
  });

  it("classifies a day without photos as off", () => {
    expect(kindOfDay({ date: "2025-08-15", photosOutsideZone: 0, photosInsideZone: 0 })).toBe(
      "off",
    );
  });
});

describe("classifyTravelDays (consecutive-days rule)", () => {
  it("marks days in a run of at least N consecutive out-days as travel", () => {
    const days = classifyTravelDays(
      [facts("2025-08-10", 5), facts("2025-08-11", 1), facts("2025-08-12", 9)],
      2,
    );
    expect(days).toEqual([
      { date: "2025-08-10", kind: "travel" },
      { date: "2025-08-11", kind: "travel" },
      { date: "2025-08-12", kind: "travel" },
    ]);
  });

  it("does not qualify a single isolated day with photos (run < N)", () => {
    const days = classifyTravelDays([facts("2025-08-10", 80)], 2);
    expect(days).toEqual([{ date: "2025-08-10", kind: "no_visit" }]);
  });

  it("does not require the same locality: any out-of-zone photos count", () => {
    // Two consecutive days, different localities — still a run of 2
    const days = classifyTravelDays([facts("2025-08-10", 20), facts("2025-08-11", 3)], 2);
    expect(days.every((d) => d.kind === "travel")).toBe(true);
  });

  it("breaks runs on days without photos", () => {
    const days = classifyTravelDays(
      [facts("2025-08-10", 5), facts("2025-08-11", 0), facts("2025-08-12", 5)],
      2,
    );
    expect(days.every((d) => d.kind === "no_visit")).toBe(true);
  });

  it("breaks runs on fully excluded days (the user was home)", () => {
    const days = classifyTravelDays(
      [facts("2025-08-10", 5), facts("2025-08-11", 0, 50), facts("2025-08-12", 5)],
      2,
    );
    expect(days).toEqual([
      { date: "2025-08-10", kind: "no_visit" },
      { date: "2025-08-11", kind: "excluded" },
      { date: "2025-08-12", kind: "no_visit" },
    ]);
  });
});

describe("groupDaysIntoTrips", () => {
  it("reproduces the worked example of §10.5 (trip 10–13 August)", () => {
    const days = [
      day("2025-08-10", "travel"),
      day("2025-08-11", "travel"),
      day("2025-08-12", "no_visit"),
      day("2025-08-13", "travel"),
      day("2025-08-14", "no_visit"),
      day("2025-08-15", "no_visit"),
      day("2025-08-16", "no_visit"),
    ];
    expect(groupDaysIntoTrips(days, 3)).toEqual([
      { startDate: "2025-08-10", endDate: "2025-08-13" },
    ]);
  });

  it("tolerates 1–2 days without photos but closes at the threshold (§10.3)", () => {
    expect(
      groupDaysIntoTrips([day("2025-08-10", "travel"), day("2025-08-12", "travel")], 3),
    ).toEqual([{ startDate: "2025-08-10", endDate: "2025-08-12" }]);
    expect(
      groupDaysIntoTrips([day("2025-08-10", "travel"), day("2025-08-13", "travel")], 3),
    ).toEqual([{ startDate: "2025-08-10", endDate: "2025-08-13" }]);
    expect(
      groupDaysIntoTrips([day("2025-08-10", "travel"), day("2025-08-14", "travel")], 3),
    ).toEqual([
      { startDate: "2025-08-10", endDate: "2025-08-10" },
      { startDate: "2025-08-14", endDate: "2025-08-14" },
    ]);
  });

  it("closes the trip immediately on a fully excluded day (§9.5)", () => {
    const days = [
      day("2025-08-10", "travel"),
      day("2025-08-11", "travel"),
      day("2025-08-12", "excluded"),
      day("2025-08-13", "travel"),
    ];
    expect(groupDaysIntoTrips(days, 3)).toEqual([
      { startDate: "2025-08-10", endDate: "2025-08-11" },
      { startDate: "2025-08-13", endDate: "2025-08-13" },
    ]);
  });

  it("does not interrupt a trip when the locality changes (§10.1)", () => {
    const days = [
      day("2025-08-10", "travel"),
      day("2025-08-11", "travel"),
      day("2025-08-12", "travel"),
    ];
    expect(groupDaysIntoTrips(days, 3)).toEqual([
      { startDate: "2025-08-10", endDate: "2025-08-12" },
    ]);
  });

  it("ends the trip at the last travel day, not at the closure gap (§10.5)", () => {
    const days = [
      day("2025-08-10", "travel"),
      day("2025-08-11", "no_visit"),
      day("2025-08-12", "no_visit"),
      day("2025-08-13", "no_visit"),
    ];
    expect(groupDaysIntoTrips(days, 3)).toEqual([
      { startDate: "2025-08-10", endDate: "2025-08-10" },
    ]);
  });

  it("returns no trips without travel days and handles unsorted input", () => {
    expect(
      groupDaysIntoTrips([day("2025-08-10", "excluded"), day("2025-08-11", "no_visit")], 3),
    ).toEqual([]);
    expect(groupDaysIntoTrips([], 3)).toEqual([]);
    expect(
      groupDaysIntoTrips([day("2025-08-13", "travel"), day("2025-08-10", "travel")], 3),
    ).toEqual([{ startDate: "2025-08-10", endDate: "2025-08-13" }]);
  });
});

describe("clipIntervalsAgainstBlocked", () => {
  it("creates a new trip for data contiguous to an existing trip (§10.6)", () => {
    const clipped = clipIntervalsAgainstBlocked(
      [{ startDate: "2025-08-10", endDate: "2025-08-13" }],
      [{ startDate: "2025-08-10", endDate: "2025-08-11" }],
    );
    expect(clipped).toEqual([{ startDate: "2025-08-12", endDate: "2025-08-13" }]);
  });

  it("returns nothing when the candidate is fully covered", () => {
    expect(
      clipIntervalsAgainstBlocked(
        [{ startDate: "2025-08-10", endDate: "2025-08-13" }],
        [{ startDate: "2025-08-09", endDate: "2025-08-14" }],
      ),
    ).toEqual([]);
  });

  it("splits a candidate spanning an existing trip into two segments", () => {
    expect(
      clipIntervalsAgainstBlocked(
        [{ startDate: "2025-08-10", endDate: "2025-08-20" }],
        [{ startDate: "2025-08-12", endDate: "2025-08-14" }],
      ),
    ).toEqual([
      { startDate: "2025-08-10", endDate: "2025-08-11" },
      { startDate: "2025-08-15", endDate: "2025-08-20" },
    ]);
  });

  it("leaves candidates untouched without blocked intervals", () => {
    expect(
      clipIntervalsAgainstBlocked([{ startDate: "2025-08-10", endDate: "2025-08-13" }], []),
    ).toEqual([{ startDate: "2025-08-10", endDate: "2025-08-13" }]);
  });

  it("clips against multiple blocked intervals", () => {
    expect(
      clipIntervalsAgainstBlocked(
        [{ startDate: "2025-08-01", endDate: "2025-08-31" }],
        [
          { startDate: "2025-08-05", endDate: "2025-08-10" },
          { startDate: "2025-08-20", endDate: "2025-08-25" },
        ],
      ),
    ).toEqual([
      { startDate: "2025-08-01", endDate: "2025-08-04" },
      { startDate: "2025-08-11", endDate: "2025-08-19" },
      { startDate: "2025-08-26", endDate: "2025-08-31" },
    ]);
  });
});

describe("formatAutoTripName", () => {
  it("uses a locale-independent ISO date", () => {
    expect(formatAutoTripName("2025-08-10")).toBe("Viaggio 2025-08-10");
  });

  it("clips against multiple blocked intervals", () => {
    expect(
      clipIntervalsAgainstBlocked(
        [{ startDate: "2025-08-01", endDate: "2025-08-31" }],
        [
          { startDate: "2025-08-05", endDate: "2025-08-10" },
          { startDate: "2025-08-20", endDate: "2025-08-25" },
        ],
      ),
    ).toEqual([
      { startDate: "2025-08-01", endDate: "2025-08-04" },
      { startDate: "2025-08-11", endDate: "2025-08-19" },
      { startDate: "2025-08-26", endDate: "2025-08-31" },
    ]);
  });
});

describe("formatAutoTripName", () => {
  it("uses a locale-independent ISO date", () => {
    expect(formatAutoTripName("2025-08-10")).toBe("Viaggio 2025-08-10");
  });
});
