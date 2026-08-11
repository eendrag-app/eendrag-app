import { knockoutLabel, type Match } from "./tournament";

// The old app's guards, ported and made explicit. They exist because the
// bracket is derived from results: clearing a result that a later round was
// built on would leave the draw describing a competition that never happened.
//
// Pure — tested in guards.test.ts.

export type Guard = { ok: true } | { ok: false; reason: string };

const OK: Guard = { ok: true };

/**
 * May this result be cleared?
 *
 * - A group result locks as soon as ANY knockout match has been played: the
 *   quarter-finals were seeded from the group standings.
 * - A knockout result locks once the match it feeds has been played: clearing
 *   QF1 while SF1 is in the books would orphan SF1's teams.
 */
export function canClearResult(match: Match, all: Match[]): Guard {
  if (!match.played) return OK;

  if (match.stage === "group") {
    const knockoutPlayed = all.some((m) => m.stage !== "group" && m.played);
    return knockoutPlayed
      ? {
          ok: false,
          reason:
            "The knockouts have already started, so the group results are locked. Clear the knockout results first.",
        }
      : OK;
  }

  const label = knockoutLabel(match);
  const feeds = all.find((m) => m.played && m.sources?.includes(label));
  return feeds
    ? {
        ok: false,
        reason: `${knockoutLabel(feeds)} has already been played and was decided by this match. Clear ${knockoutLabel(feeds)} first.`,
      }
    : OK;
}

/**
 * May the groups still be edited? Only until a group game has been played —
 * after that, moving a team would rewrite games that already happened.
 */
export function canEditGroups(all: Match[]): Guard {
  const started = all.some((m) => m.stage === "group" && m.played);
  return started
    ? {
        ok: false,
        reason: "Group games have started, so the groups are fixed for this event.",
      }
    : OK;
}

/** May the whole draw be thrown away and generated again? Only if nothing has been played. */
export function canRegenerateDraw(all: Match[]): Guard {
  return all.some((m) => m.played)
    ? {
        ok: false,
        reason:
          "Results have been entered for this event. Clear them, or delete the event and start again.",
      }
    : OK;
}

/**
 * May an admin override this knockout pairing by hand? Group games have fixed
 * opponents, and a played match is history.
 */
export function canEditTeams(match: Match): Guard {
  if (match.stage === "group") {
    return { ok: false, reason: "Group games are set by the draw." };
  }
  if (match.played) {
    return { ok: false, reason: "Clear the result first." };
  }
  return OK;
}
