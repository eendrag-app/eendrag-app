// Quiet hours — pure time arithmetic, tested in quiet-hours.test.ts.
// Default 23:00–07:00 (set on profiles). Notifications are ALWAYS persisted;
// quiet hours only defer delivery (the push channel), never the bell. Urgent
// bypasses quiet hours entirely — the pipeline never calls this for urgent.

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Is `at` inside the window start→end (window may cross midnight)? */
export function isInQuietHours(at: Date, start: string, end: string): boolean {
  const now = at.getHours() * 60 + at.getMinutes();
  const s = minutesOfDay(start);
  const e = minutesOfDay(end);
  if (s === e) return false; // zero-length window = quiet hours off
  if (s < e) return now >= s && now < e; // e.g. 01:00–06:00
  return now >= s || now < e; // e.g. 23:00–07:00 (crosses midnight)
}

/** When to deliver: now, or the moment the recipient's quiet hours end. */
export function deliveryTime(at: Date, start: string, end: string): Date {
  if (!isInQuietHours(at, start, end)) return at;
  const [h, m] = end.split(":").map(Number);
  const out = new Date(at);
  out.setHours(h, m, 0, 0);
  if (out <= at) out.setDate(out.getDate() + 1); // end is tomorrow morning
  return out;
}
