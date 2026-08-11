import "server-only";
import { createAdminClient } from "@/core/db/admin";
import { channels } from "./channels";
import { deliveryTime } from "./quiet-hours";
import { resolveRecipients } from "./targeting";
import type { NotificationTrigger, RecipientCandidate } from "./types";

// The pipeline: trigger → targeting → preference filter → quiet hours →
// persisted notifications rows → channels. Modules call notify() from server
// actions; nothing here runs in the browser.
//
// Uses the admin client on purpose: one trigger writes rows for many users,
// which no single user's RLS permissions could do.

async function fetchCandidates(): Promise<RecipientCandidate[]> {
  const db = createAdminClient();

  // Three flat queries instead of nested joins: boring and easy to reason
  // about at 280-user scale.
  const [profiles, prefs, sports] = await Promise.all([
    db
      .from("profiles")
      .select("id, section_id, role, is_active, quiet_hours_start, quiet_hours_end"),
    db.from("notification_preferences").select("profile_id, category, enabled"),
    db.from("user_sports").select("profile_id, sport_id"),
  ]);
  if (profiles.error) throw profiles.error;
  if (prefs.error) throw prefs.error;
  if (sports.error) throw sports.error;

  const prefsByProfile = new Map<string, RecipientCandidate["preferences"]>();
  for (const p of prefs.data) {
    const entry = prefsByProfile.get(p.profile_id) ?? {};
    entry[p.category as keyof typeof entry] = p.enabled;
    prefsByProfile.set(p.profile_id, entry);
  }

  const sportsByProfile = new Map<string, string[]>();
  for (const s of sports.data) {
    const list = sportsByProfile.get(s.profile_id) ?? [];
    list.push(s.sport_id);
    sportsByProfile.set(s.profile_id, list);
  }

  return profiles.data.map((p) => ({
    profileId: p.id,
    sectionId: p.section_id,
    role: p.role as RecipientCandidate["role"],
    isActive: p.is_active,
    sportIds: sportsByProfile.get(p.id) ?? [],
    preferences: prefsByProfile.get(p.id) ?? {},
    quietHoursStart: p.quiet_hours_start,
    quietHoursEnd: p.quiet_hours_end,
  }));
}

/**
 * Send a notification. Resolves recipients, persists one notifications row
 * per recipient, then hands the batch to every delivery channel.
 * Returns the number of recipients.
 */
export async function notify(trigger: NotificationTrigger): Promise<number> {
  const recipients = resolveRecipients(trigger, await fetchCandidates());
  if (recipients.length === 0) return 0;

  const db = createAdminClient();
  const { data, error } = await db
    .from("notifications")
    .insert(
      recipients.map((r) => ({
        profile_id: r.profileId,
        category: trigger.category,
        title: trigger.title,
        body: trigger.body ?? "",
        url: trigger.url ?? "/",
        source_module: trigger.sourceModule,
        source_ref: trigger.sourceRef ?? "",
      })),
    )
    .select("id, profile_id");
  if (error) throw error;

  const now = new Date();
  const idByProfile = new Map(data.map((n) => [n.profile_id, n.id]));
  const batch = {
    trigger,
    deliveries: recipients.map((r) => ({
      profileId: r.profileId,
      notificationId: idByProfile.get(r.profileId)!,
      deliverAt: trigger.urgent
        ? now
        : deliveryTime(now, r.quietHoursStart, r.quietHoursEnd),
    })),
  };

  // A channel failing must never lose the rows (already persisted) or block
  // the caller's action — log and continue.
  for (const channel of channels) {
    try {
      await channel.deliver(batch);
    } catch (err) {
      console.error(`notification channel "${channel.id}" failed:`, err);
    }
  }

  return recipients.length;
}
