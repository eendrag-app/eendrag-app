import "server-only";
import { createAdminClient } from "@/core/db/admin";
import { isPushConfigured, pushToProfiles } from "./web-push";

// Quiet hours, delivered. Anything the pipeline deferred — a fixture posted at
// midnight, an announcement published while someone was asleep — sits in the
// notifications table with a future `deliver_at` and no `pushed_at`. This is
// what comes back for it, from the cron tick.
//
// Idempotent: `pushed_at` is stamped as soon as a row has been sent, and only
// rows still missing it are ever picked up.

/** One tick's worth. Comfortably above 280 people × a busy night. */
const BATCH_LIMIT = 500;

/**
 * How far back a deferred push is still worth sending.
 *
 * If the tick has been down overnight — GitHub disables scheduled workflows
 * after 60 quiet days, and does — the queue must NOT flush all at once into
 * everybody's lock screen the moment it comes back. Anything older than this
 * is quietly marked as delivered instead: it is already in the bell, which is
 * where a day-old notification belongs.
 */
const STALE_AFTER_HOURS = 6;

export async function deliverDuePushes(now: Date): Promise<number> {
  if (!isPushConfigured()) return 0;

  const db = createAdminClient();
  const stale = new Date(now.getTime() - STALE_AFTER_HOURS * 3600_000);

  const { data: rows, error } = await db
    .from("notifications")
    .select("id, profile_id, category, title, body, url, deliver_at")
    .is("pushed_at", null)
    .lte("deliver_at", now.toISOString())
    .order("deliver_at")
    .limit(BATCH_LIMIT);
  if (error) throw error;
  if (!rows || rows.length === 0) return 0;

  const tooOld = rows.filter((r) => new Date(r.deliver_at) < stale);
  const fresh = rows.filter((r) => new Date(r.deliver_at) >= stale);

  if (tooOld.length > 0) {
    await db
      .from("notifications")
      .update({ pushed_at: now.toISOString() })
      .in(
        "id",
        tooOld.map((r) => r.id),
      );
    console.info(`[web-push] skipped ${tooOld.length} stale deferred notification(s)`);
  }

  let sent = 0;
  // One send per row rather than per person: two different things waited out
  // the same quiet hours and both deserve to be said. They are grouped on the
  // phone by category (the `tag`), so this is not five separate buzzes.
  for (const row of fresh) {
    await pushToProfiles([row.profile_id], {
      title: row.title,
      body: row.body,
      url: row.url,
      tag: row.category,
      // Urgent notifications are never deferred in the first place, so
      // anything arriving here is by definition not urgent.
      urgent: false,
    });
    sent += 1;
  }

  if (fresh.length > 0) {
    const { error: markError } = await db
      .from("notifications")
      .update({ pushed_at: now.toISOString() })
      .in(
        "id",
        fresh.map((r) => r.id),
      );
    if (markError) throw markError;
  }

  return sent;
}
