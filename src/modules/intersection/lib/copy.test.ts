import { describe, expect, it } from "vitest";
import { calendarTitle, ordinal, positionMove, resultHeadline, stageLabel, teamsLabel } from "./copy";
import type { LeaderboardRow, Match } from "./tournament";

const names: Record<string, string> = { kat: "Katstraat", stop: "Stopstraat", dis: "District" };
const nameOf = (id: string) => names[id] ?? id;

function match(partial: Partial<Match> & Pick<Match, "id" | "stage">): Match {
  return {
    groupId: null,
    slot: null,
    sources: null,
    teamAId: null,
    teamBId: null,
    winnerId: null,
    played: false,
    manual: false,
    sortOrder: 0,
    ...partial,
  };
}

describe("ordinal", () => {
  it("handles the awkward ones", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
    ]);
  });
});

describe("stageLabel", () => {
  it("names the round", () => {
    expect(stageLabel(match({ id: "1", stage: "group", groupId: "g" }), "A")).toBe("Group A");
    expect(stageLabel(match({ id: "2", stage: "qf", slot: 3 }))).toBe("QF3");
    expect(stageLabel(match({ id: "3", stage: "sf", slot: 1 }))).toBe("SF1");
    expect(stageLabel(match({ id: "4", stage: "final", slot: 1 }))).toBe("Final");
  });
});

describe("teamsLabel", () => {
  it("uses the section names once both are known", () => {
    expect(teamsLabel(match({ id: "1", stage: "qf", teamAId: "kat", teamBId: "stop" }), nameOf)).toBe(
      "Katstraat vs Stopstraat",
    );
  });

  it("falls back to what the bracket promises", () => {
    expect(
      teamsLabel(match({ id: "1", stage: "qf", slot: 1, sources: ["A1", "B2"] }), nameOf),
    ).toBe("Group A winner vs Group B runner-up");
  });

  it("mixes the two when only one side is decided", () => {
    expect(
      teamsLabel(
        match({ id: "1", stage: "sf", slot: 1, sources: ["QF1", "QF2"], teamAId: "kat" }),
        nameOf,
      ),
    ).toBe("Katstraat vs Winner QF2");
  });
});

describe("calendarTitle", () => {
  it("reads as a calendar entry", () => {
    expect(
      calendarTitle(
        "Touch Rugby Day",
        match({ id: "1", stage: "qf", slot: 1, teamAId: "kat", teamBId: "stop" }),
        null,
        nameOf,
      ),
    ).toBe("Touch Rugby Day: QF1 — Katstraat vs Stopstraat");
  });
});

describe("resultHeadline", () => {
  it("says who beat whom", () => {
    expect(resultHeadline("Katstraat", "District", "Touch Rugby Day")).toBe(
      "Katstraat beat District — Touch Rugby Day",
    );
  });
});

describe("positionMove", () => {
  const row = (sectionId: string, name: string, points: number): LeaderboardRow => ({
    sectionId,
    name,
    points,
    eventsWon: 0,
    // Irrelevant here: positionMove compares positions, not where the points
    // came from.
    carry: 0,
  });

  it("reports a move up the table", () => {
    const before = [row("dis", "District", 12), row("kat", "Katstraat", 9)];
    const after = [row("kat", "Katstraat", 15), row("dis", "District", 12)];
    expect(positionMove(before, after, "kat")).toBe("Katstraat move to 1st on the leaderboard");
    expect(positionMove(before, after, "dis")).toBe("District move to 2nd on the leaderboard");
  });

  it("says nothing when nothing moved", () => {
    const table = [row("dis", "District", 12), row("kat", "Katstraat", 9)];
    expect(positionMove(table, table, "kat")).toBeNull();
  });
});
