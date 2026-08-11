import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dayKey,
  formatDate,
  formatDateTime,
  formatTime,
  relativeTime,
  startOfDay,
  startOfMonth,
  weekdayIndex,
} from "./format";

// These pin the two properties the UI depends on: everything is rendered in
// South African time regardless of where the server runs, and day arithmetic
// lands on real local midnights (the calendar grid depends on it).

const noon = new Date("2026-08-13T10:00:00Z"); // 12:00 SAST, a Thursday

describe("formatting is always South African time", () => {
  it("formats a time in SAST, not UTC", () => {
    expect(formatTime(noon)).toBe("12:00");
  });

  it("formats a date", () => {
    expect(formatDate(noon)).toBe("Thu 13 Aug");
  });

  it("combines date and time", () => {
    expect(formatDateTime(noon)).toBe("Thu 13 Aug, 12:00");
  });

  it("puts a late-evening UTC instant on the next local day", () => {
    // 23:30 UTC on the 13th is 01:30 SAST on the 14th.
    expect(dayKey(new Date("2026-08-13T23:30:00Z"))).toBe("2026-08-14");
  });
});

describe("day arithmetic", () => {
  it("startOfDay is local midnight", () => {
    expect(startOfDay("2026-08-13").toISOString()).toBe("2026-08-12T22:00:00.000Z");
  });

  it("startOfMonth snaps to the first", () => {
    expect(dayKey(startOfMonth(noon))).toBe("2026-08-01");
  });

  it("addDays crosses month boundaries", () => {
    expect(dayKey(addDays(startOfDay("2026-08-31"), 1))).toBe("2026-09-01");
  });

  it("addMonths wraps the year", () => {
    expect(dayKey(addMonths(startOfDay("2026-12-01"), 1))).toBe("2027-01-01");
    expect(dayKey(addMonths(startOfDay("2026-01-01"), -1))).toBe("2025-12-01");
  });

  it("weekdayIndex counts from Monday", () => {
    expect(weekdayIndex(startOfDay("2026-08-13"))).toBe(3); // Thursday
    expect(weekdayIndex(startOfDay("2026-08-17"))).toBe(0); // Monday
    expect(weekdayIndex(startOfDay("2026-08-16"))).toBe(6); // Sunday
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-08-13T12:00:00Z");

  it("handles the near past", () => {
    expect(relativeTime(new Date("2026-08-13T11:59:30Z"), now)).toBe("just now");
    expect(relativeTime(new Date("2026-08-13T11:45:00Z"), now)).toBe("15 min ago");
    expect(relativeTime(new Date("2026-08-13T11:00:00Z"), now)).toBe("1 hour ago");
    expect(relativeTime(new Date("2026-08-13T09:00:00Z"), now)).toBe("3 hours ago");
  });

  it("handles days", () => {
    expect(relativeTime(new Date("2026-08-12T09:00:00Z"), now)).toBe("yesterday");
    expect(relativeTime(new Date("2026-08-10T09:00:00Z"), now)).toBe("3 days ago");
  });

  it("falls back to a date once it is a week old", () => {
    expect(relativeTime(new Date("2026-08-01T09:00:00Z"), now)).toBe("Sat 1 Aug");
  });

  it("shows future instants as a date and time", () => {
    expect(relativeTime(new Date("2026-08-20T16:00:00Z"), now)).toBe("Thu 20 Aug, 18:00");
  });
});
