import { knockoutLabel, sourceLabel, type LeaderboardRow, type Match } from "./tournament";

// The words the intersection module puts on the calendar and in
// notifications. Pure — tested in copy.test.ts.

export function ordinal(position: number): string {
  const suffix =
    position % 100 >= 11 && position % 100 <= 13
      ? "th"
      : position % 10 === 1
        ? "st"
        : position % 10 === 2
          ? "nd"
          : position % 10 === 3
            ? "rd"
            : "th";
  return `${position}${suffix}`;
}

/** "Group A", "QF1", "SF2", "Final". */
export function stageLabel(match: Match, groupName?: string | null): string {
  if (match.stage === "group") return groupName ? `Group ${groupName}` : "Group";
  return knockoutLabel(match);
}

/**
 * One side of a fixture: the section's name once it is known, otherwise the
 * bracket's promise ("Group A winner") — or "TBC" for a knockout slot with no
 * source at all.
 */
export function sideLabel(match: Match, side: 0 | 1, nameOf: (id: string) => string): string {
  const teamId = side === 0 ? match.teamAId : match.teamBId;
  if (teamId) return nameOf(teamId);
  const source = match.sources?.[side];
  return source ? sourceLabel(source) : "TBC";
}

/**
 * "Katstraat vs Stopstraat" once both are known, otherwise the bracket's own
 * promise: "Group A winner vs Group B runner-up".
 */
export function teamsLabel(match: Match, nameOf: (id: string) => string): string {
  return `${sideLabel(match, 0, nameOf)} vs ${sideLabel(match, 1, nameOf)}`;
}

/** The title a scheduled match gets on the shared calendar. */
export function calendarTitle(
  eventName: string,
  match: Match,
  groupName: string | null,
  nameOf: (id: string) => string,
): string {
  return `${eventName}: ${stageLabel(match, groupName)} — ${teamsLabel(match, nameOf)}`;
}

/** "Katstraat beat Stopstraat" — the headline of a result notification. */
export function resultHeadline(winnerName: string, loserName: string, eventName: string): string {
  return `${winnerName} beat ${loserName} — ${eventName}`;
}

/**
 * "Katstraat move to 2nd" when an event's result shifted a section on the
 * season leaderboard, or null when nothing moved. Points only count once an
 * event's final is played, so most results move nobody — and then the
 * notification says nothing rather than something meaningless.
 */
export function positionMove(
  before: LeaderboardRow[],
  after: LeaderboardRow[],
  sectionId: string,
): string | null {
  const wasAt = before.findIndex((row) => row.sectionId === sectionId);
  const nowAt = after.findIndex((row) => row.sectionId === sectionId);
  if (wasAt === -1 || nowAt === -1 || wasAt === nowAt) return null;
  const name = after[nowAt].name;
  return `${name} move to ${ordinal(nowAt + 1)} on the leaderboard`;
}
