import "server-only";
import { createAdminClient } from "@/core/db/admin";
import { notifyAnnouncementPublished } from "./publish";

// The home module's share of the periodic tick (/api/cron/tick): releasing
// scheduled announcements. (The day-of calendar reminder moved to
// src/modules/calendar/lib/tick.ts when the calendar became its own module.)
//
// It uses the service-role client, because a cron request has no session for
// RLS to act as — one of the four sanctioned uses (docs/DECISIONS.md). It is
// idempotent: running the tick twice in the same minute, or catching up after
// the cron was down for a day, does not send anything twice.

export interface TickResult {
  published: number;
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

/** Everything the home module does on a tick. */
export async function homeTick(now: Date): Promise<TickResult> {
  return { published: await publishDueAnnouncements(now) };
}
