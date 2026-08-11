// Pure copy-writing helpers for the sport module: the strings that end up on
// the calendar, in a notification, and in the auto-announcement after a
// result. No database, no clock — tested in sport.test.ts.

/** "Hockey vs Helshoogte", or just "Hockey" for a fixture with no opponent. */
export function fixtureTitle(sportName: string, opponent: string): string {
  const other = opponent.trim();
  return other === "" ? sportName : `${sportName} vs ${other}`;
}

/** "Hockey: beat Helshoogte 3–1" — the auto-announcement's title. */
export function resultTitle(sportName: string, summary: string, score: string): string {
  const tail = score.trim() === "" ? "" : ` ${score.trim()}`;
  return `${sportName}: ${summary.trim()}${tail}`;
}

/**
 * What changed about a fixture, in the words a player needs. Returns null
 * when nothing worth a notification moved — a fixed typo must not buzz
 * everyone who plays the sport.
 */
export function fixtureChange(
  before: { startsAt: string; location: string } | null,
  after: { startsAt: string; location: string },
): "new" | "moved" | null {
  if (!before) return "new";
  if (before.startsAt !== after.startsAt || before.location !== after.location) return "moved";
  return null;
}

/** Same question for the sport's own details: only practice info and venue matter. */
export function practiceChanged(
  before: { practiceInfo: string; venue: string },
  after: { practiceInfo: string; venue: string },
): boolean {
  return before.practiceInfo !== after.practiceInfo || before.venue !== after.venue;
}

/** "Tue & Thu 18:30 · Coetzenburg B-field", skipping whatever is blank. */
export function practiceSummary(practiceInfo: string, venue: string): string {
  return [practiceInfo.trim(), venue.trim()].filter((part) => part !== "").join(" · ");
}
