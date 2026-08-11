import { describe, expect, it } from "vitest";
import { canClearResult, canEditGroups, canEditTeams, canRegenerateDraw } from "./guards";
import type { Match } from "./tournament";

// These are res law as much as the bracket is: the old app refused these
// edits, and so does this one.

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

const groupGame = match({ id: "g1", stage: "group", groupId: "A", played: true, winnerId: "x" });
const qf1 = match({ id: "qf1", stage: "qf", slot: 1, sources: ["A1", "B2"] });
const sf1 = match({ id: "sf1", stage: "sf", slot: 1, sources: ["QF1", "QF2"] });

describe("clearing a group result", () => {
  it("is allowed while the knockouts have not started", () => {
    expect(canClearResult(groupGame, [groupGame, qf1]).ok).toBe(true);
  });

  it("is blocked once any knockout has been played", () => {
    const playedQf = { ...qf1, played: true, winnerId: "x" };
    const guard = canClearResult(groupGame, [groupGame, playedQf]);
    expect(guard.ok).toBe(false);
    expect(guard.ok === false && guard.reason).toContain("knockouts have already started");
  });
});

describe("clearing a knockout result", () => {
  const playedQf1 = { ...qf1, played: true, winnerId: "x" };

  it("is allowed while the next round has not been played", () => {
    expect(canClearResult(playedQf1, [playedQf1, sf1]).ok).toBe(true);
  });

  it("is blocked when the match it feeds has been played", () => {
    const playedSf1 = { ...sf1, played: true, winnerId: "x" };
    const guard = canClearResult(playedQf1, [playedQf1, playedSf1]);
    expect(guard.ok).toBe(false);
    expect(guard.ok === false && guard.reason).toContain("SF1");
  });

  it("says nothing about a match that was never played", () => {
    expect(canClearResult(qf1, [qf1, sf1]).ok).toBe(true);
  });
});

describe("editing groups", () => {
  it("is allowed before any group game", () => {
    expect(canEditGroups([{ ...groupGame, played: false, winnerId: null }, qf1]).ok).toBe(true);
  });

  it("is blocked once a group game has been played", () => {
    expect(canEditGroups([groupGame]).ok).toBe(false);
  });
});

describe("regenerating the draw", () => {
  it("is allowed while nothing has been played", () => {
    expect(canRegenerateDraw([qf1, sf1]).ok).toBe(true);
  });

  it("is blocked once anything has been played", () => {
    expect(canRegenerateDraw([groupGame]).ok).toBe(false);
  });
});

describe("overriding a pairing by hand", () => {
  it("is allowed for an unplayed knockout match", () => {
    expect(canEditTeams(qf1).ok).toBe(true);
  });

  it("is not offered for group games", () => {
    expect(canEditTeams({ ...groupGame, played: false }).ok).toBe(false);
  });

  it("is not offered once the match has been played", () => {
    expect(canEditTeams({ ...qf1, played: true }).ok).toBe(false);
  });
});
