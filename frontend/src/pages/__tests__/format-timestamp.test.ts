import { describe, it, expect } from "vitest";
import { formatTimestamp } from "../ScansPage";

describe("formatTimestamp", () => {
  it("renders a UTC instant in the browser local time (offset removed)", () => {
    // 2026-09-01T21:00:34Z in Europe/Rome (UTC+2, DST) = 23:00:34 local
    const out = formatTimestamp("2026-09-01T21:00:34.433Z");
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    // The formatted time must equal the local representation of the instant
    const d = new Date("2026-09-01T21:00:34.433Z");
    const pad = (n: number): string => String(n).padStart(2, "0");
    const expected =
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      ` ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    expect(out).toBe(expected);
    // And it must NOT be the raw UTC string when the local zone is not UTC
    const utcString = "2026-09-01 21:00:34";
    if (d.getTimezoneOffset() !== 0) {
      expect(out).not.toBe(utcString);
    }
  });

  it("returns the raw value when it cannot be parsed", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});
