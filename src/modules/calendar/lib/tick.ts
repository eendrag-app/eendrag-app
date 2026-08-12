import "server-only";
import { createAdminClient } from "@/core/db/admin";
import { notify } from "@/core/notifications";
import { formatDateTime } from "@/core/ui/format";

// The calendar module's share of the periodic tick (/api/cron/tick): the
// day-of reminder for what is on today.
//
// It uses the service-role client, because a cron request has no session for
// RLS to act as — one of the four sanctioned uses (docs/DECISIONS.md). It is
// idempotent: running the tick twice in the same minute, or catching up after
// the cron was down for a day, does not remind anyone twice.

/** How far ahead a calendar reminder looks. One tick a day would still catch everything. */
const REMINDER_WINDOW_HOURS = 24;

/** Reminders are recognised by this prefix on the notification's source_ref. */
const REMINDER_REF = (eventId: string) => `reminder:${eventId}`;

/**
 * Remind people about events starting in the next day — the res-wide and
 * section ones, plus sport fixtures. Intersection games are reminded by the
 * intersection module instead, which knows which two sections are playing.
 *
 * Idempotent because it asks the notifications table whether a reminder for
 * this event has already gone out. That is cheaper and less fragile than a
 * "reminded_at" column nobody would remember to reset when an event moves.
 */
export async function remindUpcomingEvents(now: Date): Promise<number> {
  const db = createAdminClient();
  const until = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 3600_000);

  const { data: events, error } = await db
    .from("events")
    .select("id, title, location, starts_at, section_id, source_module")
    .gte("starts_at", now.toISOString())
    .lt("starts_at", until.toISOString())
    .order("starts_at");
  if (error) throw error;
  const candidates = (events ?? []).filter((e) => e.source_module !== "intersection");
  if (candidates.length === 0) return 0;

  const { data: already } = await db
    .from("notifications")
    .select("source_ref")
    .in("source_ref", candidates.map((e) => REMINDER_REF(e.id)));
  const done = new Set((already ?? []).map((n) => n.source_ref));

  let sent = 0;
  for (const event of candidates) {
    if (done.has(REMINDER_REF(event.id))) continue;
    await notify({
      category: "calendar",
      title: `Today: ${event.title}`,
      body: `${formatDateTime(event.starts_at)}${event.location ? ` · ${event.location}` : ""}`,
      url: "/calendar",
      sourceModule: "calendar",
      sourceRef: REMINDER_REF(event.id),
      audience: event.section_id ? { kind: "section", sectionId: event.section_id } : { kind: "all" },
      aboutSectionId: event.section_id ?? undefined,
    });
    sent += 1;
  }
  return sent;
}

/** Everything the calendar module does on a tick. */
export async function calendarTick(now: Date): Promise<{ reminders: number }> {
  return { reminders: await remindUpcomingEvents(now) };
}
