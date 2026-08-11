import "server-only";
import { createAdminClient } from "@/core/db/admin";
import { notify } from "@/core/notifications";
import { formatDateTime } from "@/core/ui/format";
import { notifyAnnouncementPublished } from "./publish";

// The home module's share of the periodic tick (/api/cron/tick): releasing
// scheduled announcements, and reminding people about what is on today.
//
// Both use the service-role client, because a cron request has no session for
// RLS to act as — the fourth and last sanctioned use (docs/DECISIONS.md).
// Both are idempotent: running the tick twice in the same minute, or catching
// up after the cron was down for a day, does not send anything twice.

/** How far ahead a calendar reminder looks. One tick a day would still catch everything. */
const REMINDER_WINDOW_HOURS = 24;

/** Reminders are recognised by this prefix on the notification's source_ref. */
const REMINDER_REF = (eventId: string) => `reminder:${eventId}`;

export interface TickResult {
  published: number;
  reminders: number;
}

/**
 * Publish every announcement whose scheduled time has passed.
 *
 * Idempotent because publishing flips `status` — a second run finds nothing
 * due. If the cron was down, everything that came due meanwhile goes out on
 * the next tick, in order, which is the right behaviour for announcements
 * (better late than never).
 */
export async function publishDueAnnouncements(now: Date): Promise<number> {
  const db = createAdminClient();
  const { data: due, error } = await db
    .from("announcements")
    .select("id, title, body, is_urgent, target_section_id")
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for");
  if (error) throw error;
  if (!due || due.length === 0) return 0;

  let published = 0;
  for (const announcement of due) {
    const { error: updateError } = await db
      .from("announcements")
      .update({
        status: "published",
        published_at: now.toISOString(),
        scheduled_for: null,
      })
      .eq("id", announcement.id)
      // Only if it is still scheduled: if two ticks overlap, the second one
      // updates nothing and the notification is not sent twice.
      .eq("status", "scheduled")
      .select("id");
    if (updateError) throw updateError;

    await notifyAnnouncementPublished(announcement);
    published += 1;
  }
  return published;
}

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
      url: "/",
      sourceModule: "home",
      sourceRef: REMINDER_REF(event.id),
      audience: event.section_id ? { kind: "section", sectionId: event.section_id } : { kind: "all" },
      aboutSectionId: event.section_id ?? undefined,
    });
    sent += 1;
  }
  return sent;
}

/** Everything the home module does on a tick. */
export async function homeTick(now: Date): Promise<TickResult> {
  return {
    published: await publishDueAnnouncements(now),
    reminders: await remindUpcomingEvents(now),
  };
}
