import { addDays, dayKey, startOfMonth, weekdayIndex } from "@/core/ui/format";

// Pure calendar arithmetic for the month grid. No database, no components —
// tested in calendar.test.ts.

/** Six weeks of seven days: always the same shape, so the grid never jumps. */
export const GRID_DAYS = 42;

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** How far either side of today the home page loads events for. */
export const WINDOW_MONTHS_BACK = 1;
export const WINDOW_MONTHS_AHEAD = 12;

export interface CalendarEvent {
  id: string;
  title: string;
  category: string;
  location: string;
  dayKey: string; // "2026-08-13", already in res time
  timeLabel: string; // "19:00"
  sectionName: string | null;
  sourceModule: string | null; // null = created by hand by an admin
}

/**
 * The 42 day-keys a month's grid shows, starting on the Monday of the week
 * containing the 1st. Includes the trailing days of the previous month and
 * the leading days of the next — that is what makes it a calendar.
 */
export function monthGridKeys(month: Date): string[] {
  const first = startOfMonth(month);
  const start = addDays(first, -weekdayIndex(first));
  return Array.from({ length: GRID_DAYS }, (_, i) => dayKey(addDays(start, i)));
}

/** Events bucketed by day-key, keeping the order they came in (by start time). */
export function groupByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = byDay.get(event.dayKey);
    if (list) list.push(event);
    else byDay.set(event.dayKey, [event]);
  }
  return byDay;
}

/** Is this day-key inside the month that `month` belongs to? */
export function isInMonth(key: string, month: Date): boolean {
  return key.slice(0, 7) === dayKey(month).slice(0, 7);
}
