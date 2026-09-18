import { describe, expect, it } from "vitest";
import {
  generateDraw,
  leaderboard,
  canDraw,
  needsTieBreak,
  placements,
  qualifiers,
  recalc,
  scoreOutcome,
  sourceLabel,
  standings,
  tieBreakFits,
  type Group,
  type Match,
} from "./tournament";

// Behaviour parity tests with the old eendrag-intersection app. The bracket
// rules here ARE the competition — don't change expectations without HK
// agreeing the format itself changed.

// The live scheme, matching the old app's POINTS (see
// 0504_intersection_points_scheme.sql for why these numbers and not others).
const POINTS = { champion: 12, runnerUp: 8, semis: 5, quarters: 3, group: 0 };

const SECTIONS = [
  "here-xvii",
  "wallstreet",
  "ingang",
  "stopstraat",
  "katstraat",
  "bun-boulevard",
  "district",
  "sensasie",
  "wineroute",
  "jacaranda",
  "arendstraat",
  "route-61",
];
const name = (id: string) => id;

// Deterministic "random": keeps original order.
const noShuffle = () => 0.999999;

let nextId = 0;
function match(partial: Partial<Match> & Pick<Match, "stage" | "sortOrder">): Match {
  return {
    id: "m" + nextId++,
    groupId: null,
    slot: null,
    sources: null,
    teamAId: null,
    teamBId: null,
    winnerId: null,
    draw: false,
    aScore: null,
    bScore: null,
    played: false,
    manual: false,
    ...partial,
  };
}

/** A played group game in g1 with scores; the winner follows from them, level = a draw. */
function scored(a: string, b: string, aScore: number, bScore: number, sortOrder = 1): Match {
  return match({
    stage: "group",
    sortOrder,
    groupId: "g1",
    teamAId: a,
    teamBId: b,
    aScore,
    bScore,
    winnerId: aScore > bScore ? a : bScore > aScore ? b : null,
    draw: aScore === bScore,
    played: true,
  });
}

describe("generateDraw", () => {
  const { groups, matches } = generateDraw(SECTIONS, noShuffle);

  it("makes 4 groups of 3 covering all 12 sections exactly once", () => {
    expect(groups.map((g) => g.name)).toEqual(["A", "B", "C", "D"]);
    const all = groups.flatMap((g) => g.sectionIds);
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(12);
  });

  it("creates 12 group matches interleaved one per group per round", () => {
    const groupMatches = matches.filter((m) => m.stage === "group");
    expect(groupMatches).toHaveLength(12);
    // Round 1 = sortOrder 1..4, one per group A,B,C,D
    expect(groupMatches.slice(0, 4).map((m) => m.groupName)).toEqual(["A", "B", "C", "D"]);
    // Pair pattern per round: (0,1) then (1,2) then (0,2)
    expect([groupMatches[0].teamASlot, groupMatches[0].teamBSlot]).toEqual([0, 1]);
    expect([groupMatches[4].teamASlot, groupMatches[4].teamBSlot]).toEqual([1, 2]);
    expect([groupMatches[8].teamASlot, groupMatches[8].teamBSlot]).toEqual([0, 2]);
  });

  it("creates the knockout skeleton with the fixed pairings", () => {
    const qfs = matches.filter((m) => m.stage === "qf");
    expect(qfs.map((m) => m.sources)).toEqual([
      ["A1", "B2"],
      ["C1", "D2"],
      ["B1", "A2"],
      ["D1", "C2"],
    ]);
    const sfs = matches.filter((m) => m.stage === "sf");
    expect(sfs.map((m) => m.sources)).toEqual([
      ["QF1", "QF2"],
      ["QF3", "QF4"],
    ]);
    expect(matches.filter((m) => m.stage === "final")).toHaveLength(1);
  });

  it("rejects anything but 12 sections", () => {
    expect(() => generateDraw(SECTIONS.slice(0, 9))).toThrow();
  });
});

describe("standings", () => {
  const group: Group = { id: "g1", name: "A", sectionIds: ["x", "y", "z"] };

  it("orders by points, win = 3", () => {
    const ms = [
      match({ stage: "group", sortOrder: 1, groupId: "g1", teamAId: "x", teamBId: "y", winnerId: "x", played: true }),
      match({ stage: "group", sortOrder: 2, groupId: "g1", teamAId: "y", teamBId: "z", winnerId: "y", played: true }),
      match({ stage: "group", sortOrder: 3, groupId: "g1", teamAId: "x", teamBId: "z", winnerId: "x", played: true }),
    ];
    const st = standings(group, ms, name);
    expect(st.map((r) => r.sectionId)).toEqual(["x", "y", "z"]);
    expect(st[0].points).toBe(6);
    expect(st[1].points).toBe(3);
  });

  it("breaks a points tie head-to-head", () => {
    // Everyone wins once; y beat x, so y ranks above x despite equal points.
    const ms = [
      match({ stage: "group", sortOrder: 1, groupId: "g1", teamAId: "x", teamBId: "y", winnerId: "y", played: true }),
      match({ stage: "group", sortOrder: 2, groupId: "g1", teamAId: "y", teamBId: "z", winnerId: "z", played: true }),
      match({ stage: "group", sortOrder: 3, groupId: "g1", teamAId: "x", teamBId: "z", winnerId: "x", played: true }),
    ];
    const st = standings(group, ms, name);
    const rank = Object.fromEntries(st.map((r, i) => [r.sectionId, i]));
    expect(rank["y"]).toBeLessThan(rank["x"]);
    expect(rank["z"]).toBeLessThan(rank["y"]); // z beat y
  });
});

// Build a full played-out event to exercise recalc/placements/leaderboard.
function playedOutEvent() {
  const groups: Group[] = [
    { id: "gA", name: "A", sectionIds: ["a1", "a2", "a3"] },
    { id: "gB", name: "B", sectionIds: ["b1", "b2", "b3"] },
    { id: "gC", name: "C", sectionIds: ["c1", "c2", "c3"] },
    { id: "gD", name: "D", sectionIds: ["d1", "d2", "d3"] },
  ];
  const matches: Match[] = [];
  let order = 1;
  // Every group finishes in slot order: s1 (2 wins) > s2 (1) > s3 (0).
  for (const g of groups) {
    const [s1, s2, s3] = g.sectionIds;
    matches.push(
      match({ stage: "group", sortOrder: order++, groupId: g.id, teamAId: s1, teamBId: s2, winnerId: s1, played: true }),
      match({ stage: "group", sortOrder: order++, groupId: g.id, teamAId: s2, teamBId: s3, winnerId: s2, played: true }),
      match({ stage: "group", sortOrder: order++, groupId: g.id, teamAId: s1, teamBId: s3, winnerId: s1, played: true }),
    );
  }
  matches.push(
    match({ stage: "qf", sortOrder: 101, slot: 1, sources: ["A1", "B2"] }),
    match({ stage: "qf", sortOrder: 102, slot: 2, sources: ["C1", "D2"] }),
    match({ stage: "qf", sortOrder: 103, slot: 3, sources: ["B1", "A2"] }),
    match({ stage: "qf", sortOrder: 104, slot: 4, sources: ["D1", "C2"] }),
    match({ stage: "sf", sortOrder: 111, slot: 1, sources: ["QF1", "QF2"] }),
    match({ stage: "sf", sortOrder: 112, slot: 2, sources: ["QF3", "QF4"] }),
    match({ stage: "final", sortOrder: 121, slot: 1, sources: ["SF1", "SF2"] }),
  );
  return { groups, matches };
}

describe("recalc", () => {
  it("fills QF pairings once all group games are played", () => {
    const { groups, matches } = playedOutEvent();
    const status = recalc(groups, matches, name);
    expect(status).toBe("in_progress");
    const qf1 = matches.find((m) => m.stage === "qf" && m.slot === 1)!;
    expect(qf1.teamAId).toBe("a1"); // A winner
    expect(qf1.teamBId).toBe("b2"); // B runner-up
    const qf4 = matches.find((m) => m.stage === "qf" && m.slot === 4)!;
    expect(qf4.teamAId).toBe("d1");
    expect(qf4.teamBId).toBe("c2");
  });

  it("propagates knockout winners and completes on the final", () => {
    const { groups, matches } = playedOutEvent();
    recalc(groups, matches, name);
    // Team A wins every knockout game.
    for (const stage of ["qf", "sf", "final"] as const) {
      for (const m of matches.filter((m) => m.stage === stage)) {
        recalc(groups, matches, name); // refill pairings as rounds resolve
        m.winnerId = m.teamAId;
        m.played = true;
      }
    }
    const status = recalc(groups, matches, name);
    expect(status).toBe("completed");
    const final = matches.find((m) => m.stage === "final")!;
    expect(final.teamAId).toBe("a1"); // won QF1 then SF1
    expect(final.winnerId).toBe("a1");
  });

  it("never touches a manually-overridden pairing", () => {
    const { groups, matches } = playedOutEvent();
    const qf2 = matches.find((m) => m.stage === "qf" && m.slot === 2)!;
    qf2.teamAId = "b3"; // admin's judgement call
    qf2.teamBId = "d3";
    qf2.manual = true;
    recalc(groups, matches, name);
    expect(qf2.teamAId).toBe("b3");
    expect(qf2.teamBId).toBe("d3");
  });

  it("is upcoming with nothing played", () => {
    const groups: Group[] = [{ id: "g", name: "A", sectionIds: ["x", "y", "z"] }];
    const ms = [match({ stage: "group", sortOrder: 1, groupId: "g", teamAId: "x", teamBId: "y" })];
    expect(recalc(groups, ms, name)).toBe("upcoming");
  });

  it("leaves a tied group's knockout places empty until the HK decides", () => {
    const { groups, matches } = playedOutEvent();
    tieGroupA(groups, matches);
    recalc(groups, matches, name);

    // A1 feeds QF1 and A2 feeds QF3 — both sides that come from group A are
    // blank, and the ones that do not are unaffected.
    const qf1 = matches.find((m) => m.stage === "qf" && m.slot === 1)!;
    const qf3 = matches.find((m) => m.stage === "qf" && m.slot === 3)!;
    expect(qf1.teamAId).toBeNull();
    expect(qf1.teamBId).toBe("b2");
    expect(qf3.teamAId).toBe("b1");
    expect(qf3.teamBId).toBeNull();
  });

  it("uses the HK's decision once it is made", () => {
    const { groups, matches } = playedOutEvent();
    tieGroupA(groups, matches);
    groups[0].firstSectionId = "a3";
    groups[0].secondSectionId = "a1";
    recalc(groups, matches, name);

    const qf1 = matches.find((m) => m.stage === "qf" && m.slot === 1)!;
    const qf3 = matches.find((m) => m.stage === "qf" && m.slot === 3)!;
    expect(qf1.teamAId).toBe("a3");
    expect(qf3.teamBId).toBe("a1");
  });
});

describe("needsTieBreak", () => {
  const group: Group = { id: "g1", name: "A", sectionIds: ["x", "y", "z"] };

  it("is true only when all three finish level", () => {
    // x beat y, y beat z, z beat x: one win each, and no way to split them.
    const ms = [
      match({ stage: "group", sortOrder: 1, groupId: "g1", teamAId: "x", teamBId: "y", winnerId: "x", played: true }),
      match({ stage: "group", sortOrder: 2, groupId: "g1", teamAId: "y", teamBId: "z", winnerId: "y", played: true }),
      match({ stage: "group", sortOrder: 3, groupId: "g1", teamAId: "x", teamBId: "z", winnerId: "z", played: true }),
    ];
    expect(needsTieBreak(group, ms)).toBe(true);
    expect(qualifiers(group, ms, name)).toBeNull();
  });

  it("is false when somebody won the group", () => {
    const ms = [
      match({ stage: "group", sortOrder: 1, groupId: "g1", teamAId: "x", teamBId: "y", winnerId: "x", played: true }),
      match({ stage: "group", sortOrder: 2, groupId: "g1", teamAId: "y", teamBId: "z", winnerId: "y", played: true }),
      match({ stage: "group", sortOrder: 3, groupId: "g1", teamAId: "x", teamBId: "z", winnerId: "x", played: true }),
    ];
    expect(needsTieBreak(group, ms)).toBe(false);
    expect(qualifiers(group, ms, name)).toEqual({ first: "x", second: "y" });
  });

  it("is false while games are still outstanding", () => {
    // Everyone on nothing is not a tie, it is a group that has not started.
    const ms = [
      match({ stage: "group", sortOrder: 1, groupId: "g1", teamAId: "x", teamBId: "y" }),
      match({ stage: "group", sortOrder: 2, groupId: "g1", teamAId: "y", teamBId: "z" }),
      match({ stage: "group", sortOrder: 3, groupId: "g1", teamAId: "x", teamBId: "z" }),
    ];
    expect(needsTieBreak(group, ms)).toBe(false);
  });
});

// Draws and score difference: the two per-event options from the old app's
// commits 78ba91b (draws) and 02e1a47..220b2c2 (score difference).
describe("draws", () => {
  const group: Group = { id: "g1", name: "A", sectionIds: ["x", "y", "z"] };

  it("gives 1 point each for a draw and counts it in D", () => {
    const ms = [
      match({ stage: "group", sortOrder: 1, groupId: "g1", teamAId: "x", teamBId: "y", draw: true, played: true }),
      match({ stage: "group", sortOrder: 2, groupId: "g1", teamAId: "y", teamBId: "z", winnerId: "y", played: true }),
      match({ stage: "group", sortOrder: 3, groupId: "g1", teamAId: "x", teamBId: "z", winnerId: "x", played: true }),
    ];
    const st = standings(group, ms, name);
    expect(st.map((r) => [r.sectionId, r.points, r.won, r.drawn, r.lost])).toEqual([
      ["x", 4, 1, 1, 0],
      ["y", 4, 1, 1, 0],
      ["z", 0, 0, 0, 2],
    ]);
  });

  it("asks the HK when two sections drew each other and finished level", () => {
    // x and y drew, both beat z: level on 4, and head-to-head was the draw.
    const ms = [
      match({ stage: "group", sortOrder: 1, groupId: "g1", teamAId: "x", teamBId: "y", draw: true, played: true }),
      match({ stage: "group", sortOrder: 2, groupId: "g1", teamAId: "y", teamBId: "z", winnerId: "y", played: true }),
      match({ stage: "group", sortOrder: 3, groupId: "g1", teamAId: "x", teamBId: "z", winnerId: "x", played: true }),
    ];
    expect(needsTieBreak(group, ms)).toBe(true);
    expect(qualifiers(group, ms, name)).toBeNull();
  });

  it("does not ask when a draw still leaves a clear order", () => {
    const ms = [
      match({ stage: "group", sortOrder: 1, groupId: "g1", teamAId: "x", teamBId: "y", winnerId: "x", played: true }),
      match({ stage: "group", sortOrder: 2, groupId: "g1", teamAId: "y", teamBId: "z", winnerId: "y", played: true }),
      match({ stage: "group", sortOrder: 3, groupId: "g1", teamAId: "x", teamBId: "z", draw: true, played: true }),
    ];
    // x 4, y 3, z 1 — no tie at all.
    expect(needsTieBreak(group, ms)).toBe(false);
    expect(qualifiers(group, ms, name)).toEqual({ first: "x", second: "y" });
  });

  it("asks when all three draw", () => {
    const ms = [
      match({ stage: "group", sortOrder: 1, groupId: "g1", teamAId: "x", teamBId: "y", draw: true, played: true }),
      match({ stage: "group", sortOrder: 2, groupId: "g1", teamAId: "y", teamBId: "z", draw: true, played: true }),
      match({ stage: "group", sortOrder: 3, groupId: "g1", teamAId: "x", teamBId: "z", draw: true, played: true }),
    ];
    expect(needsTieBreak(group, ms)).toBe(true);
  });
});

describe("score difference", () => {
  const group: Group = { id: "g1", name: "A", sectionIds: ["x", "y", "z"] };
  const on = { scoreDiff: true };

  it("splits a three-way tie on difference, and fills the places itself", () => {
    // A cycle, one win each — but x won big and z lost big.
    const ms = [
      scored("x", "y", 5, 0, 1), // x +5
      scored("y", "z", 2, 1, 2), // y +1
      scored("x", "z", 1, 2, 3), // z +1, x -1
    ];
    // x +4, y -4, z 0
    const st = standings(group, ms, name, on);
    expect(st.map((r) => [r.sectionId, r.points, r.diff])).toEqual([
      ["x", 3, 4],
      ["z", 3, 0],
      ["y", 3, -4],
    ]);
    expect(needsTieBreak(group, ms, on)).toBe(false);
    expect(qualifiers(group, ms, name, on)).toEqual({ first: "x", second: "z" });
  });

  it("still asks the HK when a three-way tie has equal differences and scores", () => {
    const ms = [scored("x", "y", 2, 1, 1), scored("y", "z", 2, 1, 2), scored("x", "z", 1, 2, 3)];
    // Everyone +0 with 3 scored.
    expect(needsTieBreak(group, ms, on)).toBe(true);
    expect(qualifiers(group, ms, name, on)).toBeNull();
  });

  it("uses scores for when the difference is level too", () => {
    const ms = [scored("x", "y", 3, 2, 1), scored("y", "z", 2, 1, 2), scored("x", "z", 1, 2, 3)];
    // All +0; x scored 4, y 4, z 3. x and y level on everything but
    // head-to-head, which x won — so the table is decided.
    expect(needsTieBreak(group, ms, on)).toBe(false);
    expect(standings(group, ms, name, on).map((r) => r.sectionId)).toEqual(["x", "y", "z"]);
  });

  it("splits two sections who drew each other on difference", () => {
    // x and y drew 1-1, both beat z — x by more.
    const ms = [scored("x", "y", 1, 1, 1), scored("y", "z", 1, 0, 2), scored("x", "z", 4, 0, 3)];
    expect(needsTieBreak(group, ms, on)).toBe(false);
    expect(qualifiers(group, ms, name, on)).toEqual({ first: "x", second: "y" });
  });

  it("asks when two who drew each other are also level on difference and scores", () => {
    const ms = [scored("x", "y", 1, 1, 1), scored("y", "z", 2, 0, 2), scored("x", "z", 2, 0, 3)];
    expect(needsTieBreak(group, ms, on)).toBe(true);
  });

  it("counts a result with no scores for nothing in the difference", () => {
    const ms = [
      scored("x", "y", 3, 0, 1),
      // Saved before the option was on: a winner, no scores.
      match({ stage: "group", sortOrder: 2, groupId: "g1", teamAId: "y", teamBId: "z", winnerId: "y", played: true }),
    ];
    const st = standings(group, ms, name, on);
    const y = st.find((r) => r.sectionId === "y")!;
    expect(y.points).toBe(3);
    expect(y.diff).toBe(-3);
  });

  it("is ignored with the option off, exactly as before", () => {
    // Same results as the difference-split cycle above: off, it is a tie.
    const ms = [scored("x", "y", 5, 0, 1), scored("y", "z", 2, 1, 2), scored("x", "z", 1, 2, 3)];
    expect(needsTieBreak(group, ms)).toBe(true);
    expect(needsTieBreak(group, ms, { scoreDiff: false })).toBe(true);
    expect(qualifiers(group, ms, name)).toBeNull();
  });

  it("fills the quarter-finals from the difference with no HK decision", () => {
    const { groups, matches } = playedOutEvent();
    tieGroupA(groups, matches);
    // Put scores on group A's cycle so a3 comes out top and a1 second.
    const groupA = matches.filter((m) => m.groupId === "gA");
    for (const m of groupA) {
      const winnerIsA = m.winnerId === m.teamAId;
      const margin = m.winnerId === "a3" ? 5 : m.winnerId === "a1" ? 3 : 1;
      m.aScore = winnerIsA ? margin : 0;
      m.bScore = winnerIsA ? 0 : margin;
    }
    recalc(groups, matches, name, on);
    const qf1 = matches.find((m) => m.stage === "qf" && m.slot === 1)!;
    const qf3 = matches.find((m) => m.stage === "qf" && m.slot === 3)!;
    expect(qf1.teamAId).toBe("a3");
    expect(qf3.teamBId).toBe("a1");
  });
});

describe("scoreOutcome", () => {
  it("gives it to the higher score", () => {
    expect(scoreOutcome(3, 1, true)).toEqual({ kind: "win", side: 0 });
    expect(scoreOutcome(0, 2, false)).toEqual({ kind: "win", side: 1 });
  });
  it("is a draw on level scores only where a draw is possible", () => {
    expect(scoreOutcome(2, 2, true)).toEqual({ kind: "draw" });
    expect(scoreOutcome(2, 2, false)).toEqual({ kind: "level" });
  });
  it("never lets a knockout draw", () => {
    expect(canDraw({ stage: "qf" }, true)).toBe(false);
    expect(canDraw({ stage: "group" }, true)).toBe(true);
    expect(canDraw({ stage: "group" }, false)).toBe(false);
  });
});

describe("tieBreakFits", () => {
  const group: Group = { id: "g1", name: "A", sectionIds: ["x", "y", "z"] };

  it("allows any order when all three are level", () => {
    const ms = [scored("x", "y", 1, 0, 1), scored("y", "z", 1, 0, 2), scored("x", "z", 0, 1, 3)];
    expect(tieBreakFits(group, ms, "z", "y")).toBe(true);
  });

  it("keeps the outright group winner first when only 2nd is level", () => {
    // x beat both; y and z drew.
    const ms = [
      match({ stage: "group", sortOrder: 1, groupId: "g1", teamAId: "x", teamBId: "y", winnerId: "x", played: true }),
      match({ stage: "group", sortOrder: 2, groupId: "g1", teamAId: "y", teamBId: "z", draw: true, played: true }),
      match({ stage: "group", sortOrder: 3, groupId: "g1", teamAId: "x", teamBId: "z", winnerId: "x", played: true }),
    ];
    expect(needsTieBreak(group, ms)).toBe(true);
    expect(tieBreakFits(group, ms, "x", "z")).toBe(true);
    expect(tieBreakFits(group, ms, "x", "y")).toBe(true);
    expect(tieBreakFits(group, ms, "y", "x")).toBe(false);
  });
});

/** Rewrite group A's results into a three-way cycle: a1 > a2 > a3 > a1. */
function tieGroupA(groups: Group[], matches: Match[]) {
  const [g] = groups;
  const [s1, s2, s3] = g.sectionIds;
  const gameOf = (a: string, b: string) =>
    matches.find(
      (m) =>
        m.groupId === g.id &&
        ((m.teamAId === a && m.teamBId === b) || (m.teamAId === b && m.teamBId === a)),
    )!;
  gameOf(s1, s2).winnerId = s1;
  gameOf(s2, s3).winnerId = s2;
  gameOf(s1, s3).winnerId = s3;
}

describe("placements and leaderboard", () => {
  it("assigns tiers and scores them 12/8/5/3/0", () => {
    const { groups, matches } = playedOutEvent();
    recalc(groups, matches, name);
    for (const stage of ["qf", "sf", "final"] as const) {
      for (const m of matches.filter((m) => m.stage === stage)) {
        recalc(groups, matches, name);
        m.winnerId = m.teamAId;
        m.played = true;
      }
    }
    recalc(groups, matches, name);

    const pl = placements(groups, matches)!;
    expect(pl.get("a1")).toBe("champion");
    expect(pl.get("b1")).toBe("runnerUp"); // lost the final
    expect(pl.get("c1")).toBe("semis"); // lost SF1 to a1
    expect(pl.get("b2")).toBe("quarters"); // lost QF1

    const sections = groups.flatMap((g) => g.sectionIds.map((id) => ({ id, name: id })));
    const rows = leaderboard(sections, [{ groups, matches }], POINTS);
    const byId = new Map(rows.map((r) => [r.sectionId, r]));
    expect(byId.get("a1")!.points).toBe(12);
    expect(byId.get("a1")!.eventsWon).toBe(1);
    expect(byId.get("a3")!.points).toBe(0); // group exit scores nothing
    const total = rows.reduce((s, r) => s + r.points, 0);
    // 1×12 + 1×8 + 2×5 + 4×3 + 4×0 = 42 points per event, as the old app's
    // README says.
    expect(total).toBe(42);
  });

  it("returns null placements until the final is played", () => {
    const { groups, matches } = playedOutEvent();
    expect(placements(groups, matches)).toBeNull();
  });

  // Carried-over points: what a section starts the season on, from before the
  // competition was being recorded in this app. Pinned because the leaderboard
  // the res reads is mostly made of these — see 0503_intersection_seasons.sql.
  it("starts sections on their carried-over points", () => {
    const sections = [
      { id: "a", name: "Sensasie" },
      { id: "b", name: "Wineroute" },
      { id: "c", name: "Ingang" },
    ];
    const carry = new Map([
      ["a", 65],
      ["b", 14],
    ]);
    const rows = leaderboard(sections, [], POINTS, carry);

    // Order comes from the carried totals when nothing has been played yet.
    expect(rows.map((r) => r.name)).toEqual(["Sensasie", "Wineroute", "Ingang"]);
    expect(rows[0].points).toBe(65);
    expect(rows[0].carry).toBe(65);
    // A section with no carry entry starts on nothing rather than undefined.
    expect(rows[2].points).toBe(0);
    expect(rows[2].carry).toBe(0);
  });

  it("adds event points on top of the carried total", () => {
    const { groups, matches } = playedOutEvent();
    recalc(groups, matches, name);
    for (const stage of ["qf", "sf", "final"] as const) {
      for (const m of matches.filter((m) => m.stage === stage)) {
        recalc(groups, matches, name);
        m.winnerId = m.teamAId;
        m.played = true;
      }
    }
    recalc(groups, matches, name);

    const sections = groups.flatMap((g) => g.sectionIds.map((id) => ({ id, name: id })));
    const carry = new Map([["a1", 40]]);
    const rows = leaderboard(sections, [{ groups, matches }], POINTS, carry);
    const winner = rows.find((r) => r.sectionId === "a1")!;

    expect(winner.carry).toBe(40);
    expect(winner.points).toBe(40 + POINTS.champion);
    expect(winner.eventsWon).toBe(1);
  });

  it("leaves every section on zero when no carry is given", () => {
    const sections = [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Bravo" },
    ];
    const rows = leaderboard(sections, [], POINTS);
    expect(rows.every((r) => r.points === 0 && r.carry === 0)).toBe(true);
  });
});

describe("labels", () => {
  it("describes sources for unresolved fixtures", () => {
    expect(sourceLabel("A1")).toBe("Group A winner");
    expect(sourceLabel("B2")).toBe("Group B runner-up");
    expect(sourceLabel("QF2")).toBe("Winner QF2");
  });
});
