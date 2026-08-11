import { describe, expect, it } from "vitest";
import {
  fixtureChange,
  fixtureTitle,
  practiceChanged,
  practiceSummary,
  resultTitle,
} from "./sport";

describe("fixtureTitle", () => {
  it("names the opponent", () => {
    expect(fixtureTitle("Hockey", "Helshoogte")).toBe("Hockey vs Helshoogte");
  });

  it("copes with no opponent", () => {
    expect(fixtureTitle("Hockey", "")).toBe("Hockey");
    expect(fixtureTitle("Hockey", "   ")).toBe("Hockey");
  });
});

describe("resultTitle", () => {
  it("reads like the HK wrote it", () => {
    expect(resultTitle("Hockey", "beat Helshoogte", "3–1")).toBe("Hockey: beat Helshoogte 3–1");
  });

  it("leaves out an empty score", () => {
    expect(resultTitle("Rugby", "lost a close one", "")).toBe("Rugby: lost a close one");
  });
});

describe("fixtureChange", () => {
  const after = { startsAt: "2026-08-20T17:00:00.000Z", location: "Astro" };

  it("is 'new' when there was nothing before", () => {
    expect(fixtureChange(null, after)).toBe("new");
  });

  it("is 'moved' when the time or the place changes", () => {
    expect(fixtureChange({ startsAt: "2026-08-20T16:00:00.000Z", location: "Astro" }, after)).toBe(
      "moved",
    );
    expect(fixtureChange({ startsAt: after.startsAt, location: "B-field" }, after)).toBe("moved");
  });

  it("is null when nothing players care about changed", () => {
    expect(fixtureChange({ ...after }, after)).toBeNull();
  });
});

describe("practiceChanged", () => {
  it("only fires on practice info and venue", () => {
    expect(
      practiceChanged({ practiceInfo: "Tue 18:00", venue: "Astro" }, { practiceInfo: "Tue 20:00", venue: "Astro" }),
    ).toBe(true);
    expect(
      practiceChanged({ practiceInfo: "Tue 18:00", venue: "Astro" }, { practiceInfo: "Tue 18:00", venue: "Astro" }),
    ).toBe(false);
  });
});

describe("practiceSummary", () => {
  it("joins what there is", () => {
    expect(practiceSummary("Tue & Thu 18:30", "Coetzenburg")).toBe("Tue & Thu 18:30 · Coetzenburg");
    expect(practiceSummary("Tue & Thu 18:30", "")).toBe("Tue & Thu 18:30");
    expect(practiceSummary("", "")).toBe("");
  });
});
