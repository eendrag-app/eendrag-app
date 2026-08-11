// Date and time formatting for the whole app. One file so every screen agrees
// on what "Thu 13 Aug, 19:00" looks like.
//
// TWO RULES worth knowing:
//
// 1. Everything is formatted in Africa/Johannesburg, never in the viewer's
//    browser timezone. The residence is in Stellenbosch; a student on exchange
//    should still see res times. It also makes server and client render the
//    same string, so there are no hydration mismatches.
// 2. Format on the SERVER and pass strings to client components. Client
//    components never call `new Date()` for display — that is what makes
//    server-rendered HTML and the hydrated client agree.
//
// South Africa has no daylight saving (SAST = UTC+2 all year), so day
// arithmetic is plain millisecond maths instead of a timezone library. If the
// app ever leaves the country, `OFFSET_MS` is the one thing to fix.

export const TIME_ZONE = "Africa/Johannesburg";
const OFFSET_MS = 2 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

// en-GB, not en-ZA: same 24-hour clock and day-month order, but without the
// comma en-ZA puts after the weekday ("Thu 13 Aug", not "Thu, 13 Aug").
function fmt(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, ...options });
}

/** "19:00" */
export function formatTime(at: Date | string): string {
  return fmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(at));
}

/** "Thu 13 Aug" */
export function formatDate(at: Date | string): string {
  return fmt({ weekday: "short", day: "numeric", month: "short" }).format(new Date(at));
}

/** "Thu 13 Aug, 19:00" */
export function formatDateTime(at: Date | string): string {
  return `${formatDate(at)}, ${formatTime(at)}`;
}

/** "Thursday 13 August 2026" — for detail pages and day headings. */
export function formatLongDate(at: Date | string): string {
  return fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(at),
  );
}

/** "August 2026" — the calendar month heading. */
export function formatMonthYear(at: Date | string): string {
  return fmt({ month: "long", year: "numeric" }).format(new Date(at));
}

/** "2026-08-13" — the stable key for grouping events by day. */
export function dayKey(at: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
}

/** The instant of 00:00 SAST on the given day key ("2026-08-13"). */
export function startOfDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - OFFSET_MS);
}

/** The instant of 00:00 SAST on the first of the month containing `at`. */
export function startOfMonth(at: Date): Date {
  return startOfDay(dayKey(at).slice(0, 8) + "01");
}

export function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * DAY_MS);
}

export function addMonths(at: Date, months: number): Date {
  const [y, m] = dayKey(at).split("-").map(Number);
  const total = (y * 12 + (m - 1)) + months;
  const year = Math.floor(total / 12);
  const month = String((total % 12) + 1).padStart(2, "0");
  return startOfDay(`${year}-${month}-01`);
}

/** Day of the week, Monday = 0 — the calendar grid starts on Monday. */
export function weekdayIndex(at: Date): number {
  const short = fmt({ weekday: "short" }).format(at);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(short.slice(0, 3));
}

/**
 * "just now" / "12 min ago" / "3 hours ago" / "yesterday" / "Thu 13 Aug".
 * Pass `now` explicitly in tests; callers on the server pass nothing.
 */
export function relativeTime(at: Date | string, now: Date = new Date()): string {
  const then = new Date(at);
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  if (seconds < 0) return formatDateTime(then); // scheduled/future: show the date
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(then);
}
