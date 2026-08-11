import { describe, expect, it } from "vitest";
import {
  generateDraw,
  leaderboard,
  placements,
  playerStats,
  recalc,
  sourceLabel,
  standings,
  type Group,
  type Match,
} from "./tournament";

// Behaviour parity tests with the old eendrag-intersection app. The bracket
// rules here ARE the competition — don't change expectations without HK
// agreeing the format itself changed.

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
    played: false,
    manual: false,
    ...partial,
  };
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
});

describe("placements and leaderboard", () => {
  it("assigns tiers and default points 15/12/9/6/3", () => {
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
    const rows = leaderboard(sections, [{ groups, matches }], {
      champion: 15,
      runnerUp: 12,
      semis: 9,
      quarters: 6,
      group: 3,
    });
    const byId = new Map(rows.map((r) => [r.sectionId, r]));
    expect(byId.get("a1")!.points).toBe(15);
    expect(byId.get("a1")!.eventsWon).toBe(1);
    expect(byId.get("a3")!.points).toBe(3); // group exit
    const total = rows.reduce((s, r) => s + r.points, 0);
    // 1×15 + 1×12 + 2×9 + 4×6 + 4×3 = 81
    expect(total).toBe(81);
  });

  it("returns null placements until the final is played", () => {
    const { groups, matches } = playedOutEvent();
    expect(placements(groups, matches)).toBeNull();
  });
});

describe("playerStats", () => {
  it("counts rostered events and section wins in those events", () => {
    const { groups, matches } = playedOutEvent();
    recalc(groups, matches, name);
    const players = [
      { id: "p1", name: "Jaco", sectionId: "a1" }, // a1 won 2 group games
      { id: "p2", name: "Wian", sectionId: "a3" }, // a3 won none
      { id: "p3", name: "Neil", sectionId: "a1" }, // not rostered
    ];
    const rosters = [
      { eventId: "ev", playerId: "p1" },
      { eventId: "ev", playerId: "p2" },
    ];
    const stats = playerStats(players, rosters, new Map([["ev", matches]]), name);
    const byId = new Map(stats.map((s) => [s.playerId, s]));
    expect(byId.get("p1")).toMatchObject({ events: 1, wins: 2 });
    expect(byId.get("p2")).toMatchObject({ events: 1, wins: 0 });
    expect(byId.get("p3")).toMatchObject({ events: 0, wins: 0 });
  });
});

describe("labels", () => {
  it("describes sources for unresolved fixtures", () => {
    expect(sourceLabel("A1")).toBe("Group A winner");
    expect(sourceLabel("B2")).toBe("Group B runner-up");
    expect(sourceLabel("QF2")).toBe("Winner QF2");
  });
});
