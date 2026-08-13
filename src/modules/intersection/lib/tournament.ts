// Tournament logic, ported 1:1 from the old eendrag-intersection app
// (src/tournament.js) — behaviour unchanged, pinned by tournament.test.ts.
//
// Format per event: 4 random groups of 3 → round robin (no draws, win = 3
// points, tie-break head-to-head) → top 2 advance → QF → SF → Final.
// Knockout pairings: A1–B2, C1–D2, B1–A2, D1–C2.
//
// Everything here is pure: plain inputs, plain outputs, no database. Phase
// two's server actions load rows, call these, and write the results back.

export const GROUP_NAMES = ["A", "B", "C", "D"] as const;
export const QF_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ["A1", "B2"],
  ["C1", "D2"],
  ["B1", "A2"],
  ["D1", "C2"],
];
export const SF_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ["QF1", "QF2"],
  ["QF3", "QF4"],
];
export const STAGE_ORDER = { group: 0, qf: 1, sf: 2, final: 3 } as const;

export type Stage = keyof typeof STAGE_ORDER;
export type EventStatus = "upcoming" | "in_progress" | "completed";
export type PlacementTier = "champion" | "runnerUp" | "semis" | "quarters" | "group";

// Mirrors intersection_groups + intersection_group_teams: sectionIds in slot
// order (0..2) — the round-robin pattern depends on slot order.
export interface Group {
  id: string;
  name: string; // 'A'..'D'
  sectionIds: string[]; // exactly 3, slot order
  /** The HK's answer to a three-way tie: who goes through 1st and 2nd. */
  firstSectionId?: string | null;
  secondSectionId?: string | null;
}

// Mirrors intersection_matches.
export interface Match {
  id: string;
  stage: Stage;
  groupId: string | null;
  slot: number | null; // QF1..4 / SF1..2; null for group games & final
  sources: readonly [string, string] | null; // ['A1','B2'] / ['QF1','QF2'] / null
  teamAId: string | null;
  teamBId: string | null;
  winnerId: string | null;
  played: boolean;
  manual: boolean; // admin overrode the pairing — recalc must not touch it
  sortOrder: number;
}

export interface StandingsRow {
  sectionId: string;
  played: number;
  won: number;
  lost: number;
  points: number;
}

export interface LeaderboardPoints {
  champion: number;
  runnerUp: number;
  semis: number;
  quarters: number;
  group: number;
}

export function knockoutLabel(m: Match): string {
  if (m.stage === "qf") return "QF" + m.slot;
  if (m.stage === "sf") return "SF" + m.slot;
  return "Final";
}

/** 'A1' → "Group A winner", 'QF2' → "Winner QF2" */
export function sourceLabel(src: string): string {
  const g = src.match(/^([A-D])([12])$/);
  if (g) return `Group ${g[1]} ${g[2] === "1" ? "winner" : "runner-up"}`;
  return "Winner " + src;
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function byStageAndOrder(a: Match, b: Match): number {
  return STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.sortOrder - b.sortOrder;
}

// The draw as data — the caller inserts these and assigns real row ids.
export interface DrawGroup {
  name: string;
  sectionIds: string[];
}
export interface DrawMatch {
  stage: Stage;
  groupName: string | null; // which group a group-game belongs to
  slot: number | null;
  sources: readonly [string, string] | null;
  teamASlot: number | null; // slot index into the group, for group games
  teamBSlot: number | null;
  sortOrder: number;
}

/**
 * Generate a full draw for 12 sections: 4 random groups of 3, the 12 group
 * matches interleaved so each round has one match per group, then the empty
 * knockout skeleton. Pass a seeded `random` in tests for determinism.
 */
export function generateDraw(
  sectionIds: string[],
  random: () => number = Math.random,
): { groups: DrawGroup[]; matches: DrawMatch[] } {
  if (sectionIds.length !== 12) {
    throw new Error(`A draw needs exactly 12 sections, got ${sectionIds.length}`);
  }
  const ids = shuffle(sectionIds, random);
  const groups: DrawGroup[] = GROUP_NAMES.map((name, i) => ({
    name,
    sectionIds: ids.slice(i * 3, i * 3 + 3),
  }));

  const matches: DrawMatch[] = [];
  // Round-robin pattern per group, interleaved by round: (0,1) (1,2) (0,2).
  const pairs: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [0, 2],
  ];
  let order = 1;
  for (const pair of pairs) {
    for (const g of groups) {
      matches.push({
        stage: "group",
        groupName: g.name,
        slot: null,
        sources: null,
        teamASlot: pair[0],
        teamBSlot: pair[1],
        sortOrder: order++,
      });
    }
  }
  QF_SOURCES.forEach((sources, i) => {
    matches.push({
      stage: "qf",
      groupName: null,
      slot: i + 1,
      sources,
      teamASlot: null,
      teamBSlot: null,
      sortOrder: 101 + i,
    });
  });
  SF_SOURCES.forEach((sources, i) => {
    matches.push({
      stage: "sf",
      groupName: null,
      slot: i + 1,
      sources,
      teamASlot: null,
      teamBSlot: null,
      sortOrder: 111 + i,
    });
  });
  matches.push({
    stage: "final",
    groupName: null,
    slot: 1,
    sources: ["SF1", "SF2"],
    teamASlot: null,
    teamBSlot: null,
    sortOrder: 121,
  });

  return { groups, matches };
}

/**
 * Group standings. No draws: win = 3 points. Ordered by points, then
 * head-to-head, then a stable name comparison supplied by the caller.
 *
 * That last step is presentation only — it keeps the table from jumping about
 * between renders. It is NOT a tie-break: when all three finish level the
 * order here means nothing, `needsTieBreak` says so, and who actually goes
 * through is the HK's call.
 */
export function standings(
  group: Group,
  matches: Match[],
  sectionName: (id: string) => string,
): StandingsRow[] {
  const rows: StandingsRow[] = group.sectionIds.map((id) => ({
    sectionId: id,
    played: 0,
    won: 0,
    lost: 0,
    points: 0,
  }));
  const byId = new Map(rows.map((r) => [r.sectionId, r]));
  const played = matches.filter((m) => m.groupId === group.id && m.played);
  for (const m of played) {
    const a = m.teamAId ? byId.get(m.teamAId) : undefined;
    const b = m.teamBId ? byId.get(m.teamBId) : undefined;
    if (!a || !b) continue;
    a.played++;
    b.played++;
    if (m.winnerId === m.teamAId) {
      a.won++;
      b.lost++;
      a.points += 3;
    } else if (m.winnerId === m.teamBId) {
      b.won++;
      a.lost++;
      b.points += 3;
    }
  }
  const h2h = (x: StandingsRow, y: StandingsRow): number => {
    const m = played.find(
      (m) =>
        (m.teamAId === x.sectionId && m.teamBId === y.sectionId) ||
        (m.teamAId === y.sectionId && m.teamBId === x.sectionId),
    );
    if (!m || m.winnerId == null) return 0;
    return m.winnerId === x.sectionId ? -1 : 1;
  };
  rows.sort(
    (x, y) =>
      y.points - x.points ||
      h2h(x, y) ||
      sectionName(x.sectionId).localeCompare(sectionName(y.sectionId)),
  );
  return rows;
}

/**
 * Is this group's top two undecidable from its results alone?
 *
 * Three teams, one game each against the other two, no draws: either somebody
 * wins both (6/3/0) or everybody wins one (3/3/3). The second is a cycle, so
 * head-to-head is no help — and with no scores recorded there is nothing else
 * to separate them. That is the ONLY tie this format can produce, and it is
 * the HK's to settle.
 *
 * Answers false while games are still outstanding: a group is not tied, it is
 * unfinished.
 */
export function needsTieBreak(group: Group, matches: Match[]): boolean {
  const rows = standings(group, matches, () => "");
  if (rows.length < 2) return false;
  if (!rows.every((r) => r.played === rows.length - 1)) return false;
  return rows.every((r) => r.points === rows[0].points);
}

/** Who a group sends through, or null while that is not yet knowable. */
export function qualifiers(
  group: Group,
  matches: Match[],
  sectionName: (id: string) => string,
): { first: string; second: string } | null {
  if (needsTieBreak(group, matches)) {
    // Only the HK's answer will do here. Without one the knockout slots stay
    // empty rather than being filled by whatever the sort happened to do.
    return group.firstSectionId && group.secondSectionId
      ? { first: group.firstSectionId, second: group.secondSectionId }
      : null;
  }
  const st = standings(group, matches, sectionName);
  return st.length >= 2 ? { first: st[0].sectionId, second: st[1].sectionId } : null;
}

/**
 * Fill knockout participants from group ranks / earlier winners, and derive
 * the event status. Mutates the passed matches in place (mirroring the old
 * app); played matches and manually-edited pairings are never touched.
 * Returns the derived status.
 */
export function recalc(
  groups: Group[],
  matches: Match[],
  sectionName: (id: string) => string,
): EventStatus {
  const ms = matches.slice().sort(byStageAndOrder);
  const groupMs = ms.filter((m) => m.stage === "group");
  const resolveMap = new Map<string, string>();
  if (groupMs.length > 0 && groupMs.every((m) => m.played)) {
    for (const g of groups) {
      const through = qualifiers(g, matches, sectionName);
      if (!through) continue; // tied, and the HK has not said yet
      resolveMap.set(g.name + "1", through.first);
      resolveMap.set(g.name + "2", through.second);
    }
  }
  for (const m of ms) {
    if (m.stage !== "group" && m.played && m.winnerId != null) {
      resolveMap.set(knockoutLabel(m), m.winnerId);
    }
  }
  for (const m of ms) {
    if (m.stage === "group" || m.played || m.manual || !m.sources) continue;
    m.teamAId = resolveMap.get(m.sources[0]) ?? null;
    m.teamBId = resolveMap.get(m.sources[1]) ?? null;
  }
  const final = ms.find((m) => m.stage === "final");
  return final && final.played
    ? "completed"
    : ms.some((m) => m.played)
      ? "in_progress"
      : "upcoming";
}

/**
 * For a completed event: sectionId → placement tier. Returns null unless the
 * final is played.
 */
export function placements(groups: Group[], matches: Match[]): Map<string, PlacementTier> | null {
  const final = matches.find((m) => m.stage === "final");
  if (!final || !final.played) return null;
  const out = new Map<string, PlacementTier>();
  for (const g of groups) {
    for (const id of g.sectionIds) out.set(id, "group");
  }
  for (const m of matches.filter((m) => m.stage === "qf")) {
    if (m.teamAId != null) out.set(m.teamAId, "quarters");
    if (m.teamBId != null) out.set(m.teamBId, "quarters");
  }
  for (const m of matches.filter((m) => m.stage === "sf")) {
    if (m.teamAId != null) out.set(m.teamAId, "semis");
    if (m.teamBId != null) out.set(m.teamBId, "semis");
  }
  if (final.teamAId != null) out.set(final.teamAId, "runnerUp");
  if (final.teamBId != null) out.set(final.teamBId, "runnerUp");
  if (final.winnerId != null) out.set(final.winnerId, "champion");
  return out;
}

export interface LeaderboardRow {
  sectionId: string;
  name: string;
  points: number;
  eventsWon: number;
}

/**
 * The season leaderboard across completed events. Points count once an
 * event's final is played.
 */
export function leaderboard(
  sections: Array<{ id: string; name: string }>,
  completedEvents: Array<{ groups: Group[]; matches: Match[] }>,
  points: LeaderboardPoints,
): LeaderboardRow[] {
  const rows: LeaderboardRow[] = sections.map((s) => ({
    sectionId: s.id,
    name: s.name,
    points: 0,
    eventsWon: 0,
  }));
  const byId = new Map(rows.map((r) => [r.sectionId, r]));
  for (const ev of completedEvents) {
    const pl = placements(ev.groups, ev.matches);
    if (!pl) continue;
    for (const [sectionId, tier] of pl) {
      const r = byId.get(sectionId);
      if (!r) continue;
      r.points += points[tier];
      if (tier === "champion") r.eventsWon++;
    }
  }
  rows.sort(
    (a, b) => b.points - a.points || b.eventsWon - a.eventsWon || a.name.localeCompare(b.name),
  );
  return rows;
}
