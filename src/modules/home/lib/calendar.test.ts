import { describe, expect, it } from "vitest";
import { startOfDay } from "@/core/ui/format";
import { GRID_DAYS, groupByDay, isInMonth, monthGridKeys, type CalendarEvent } from "./calendar";

const event = (id: string, day: string): CalendarEvent => ({
  id,
  title: id,
  category: "res_wide",
  location: "",
  dayKey: day,
  timeLabel: "19:00",
  sectionName: null,
  sectionColor: null,
  sourceModule: null,
});

describe("monthGridKeys", () => {
  it("always returns six weeks", () => {
    expect(monthGridKeys(startOfDay("2026-08-13"))).toHaveLength(GRID_DAYS);
    expect(monthGridKeys(startOfDay("2026-02-01"))).toHaveLength(GRID_DAYS);
  });

  it("starts on the Monday of the week containing the 1st", () => {
    // 1 August 2026 is a Saturday, so the grid opens on Monday 27 July.
    const keys = monthGridKeys(startOfDay("2026-08-13"));
    expect(keys[0]).toBe("2026-07-27");
    expect(keys[5]).toBe("2026-08-01");
  });

  it("runs past the end of the month", () => {
    const keys = monthGridKeys(startOfDay("2026-08-13"));
    expect(keys.at(-1)).toBe("2026-09-06");
  });

  it("handles a month that starts on a Monday", () => {
    // 1 June 2026 is a Monday: no leading days from May.
    expect(monthGridKeys(startOfDay("2026-06-15"))[0]).toBe("2026-06-01");
  });
});

describe("groupByDay", () => {
  it("buckets events and keeps their order", () => {
    const grouped = groupByDay([
      event("a", "2026-08-13"),
      event("b", "2026-08-13"),
      event("c", "2026-08-14"),
    ]);
    expect(grouped.get("2026-08-13")?.map((e) => e.id)).toEqual(["a", "b"]);
    expect(grouped.get("2026-08-14")?.map((e) => e.id)).toEqual(["c"]);
    expect(grouped.has("2026-08-15")).toBe(false);
  });
});

describe("isInMonth", () => {
  it("tells the month's own days from the grid's padding", () => {
    const august = startOfDay("2026-08-13");
    expect(isInMonth("2026-08-01", august)).toBe(true);
    expect(isInMonth("2026-07-31", august)).toBe(false);
    expect(isInMonth("2026-09-01", august)).toBe(false);
  });
});
