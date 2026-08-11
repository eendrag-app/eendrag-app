import { describe, expect, it } from "vitest";
import { deliveryTime, isInQuietHours } from "./quiet-hours";

function at(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2026, 2, 10); // arbitrary fixed day, local time
  d.setHours(h, m, 0, 0);
  return d;
}

describe("isInQuietHours (default 23:00–07:00, crosses midnight)", () => {
  it.each([
    ["23:00", true],
    ["23:59", true],
    ["00:30", true],
    ["06:59", true],
    ["07:00", false],
    ["12:00", false],
    ["22:59", false],
  ])("%s → %s", (time, expected) => {
    expect(isInQuietHours(at(time), "23:00", "07:00")).toBe(expected);
  });

  it("handles a same-day window (01:00–06:00)", () => {
    expect(isInQuietHours(at("03:00"), "01:00", "06:00")).toBe(true);
    expect(isInQuietHours(at("07:00"), "01:00", "06:00")).toBe(false);
    expect(isInQuietHours(at("00:30"), "01:00", "06:00")).toBe(false);
  });

  it("a zero-length window means quiet hours are off", () => {
    expect(isInQuietHours(at("03:00"), "07:00", "07:00")).toBe(false);
  });
});

describe("deliveryTime", () => {
  it("delivers immediately outside quiet hours", () => {
    const now = at("14:00");
    expect(deliveryTime(now, "23:00", "07:00")).toEqual(now);
  });

  it("defers a 23:30 notification to 07:00 the next morning", () => {
    const got = deliveryTime(at("23:30"), "23:00", "07:00");
    expect(got.getHours()).toBe(7);
    expect(got.getDate()).toBe(at("23:30").getDate() + 1);
  });

  it("defers a 02:00 notification to 07:00 the same morning", () => {
    const got = deliveryTime(at("02:00"), "23:00", "07:00");
    expect(got.getHours()).toBe(7);
    expect(got.getDate()).toBe(at("02:00").getDate());
  });
});
