import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/core/db/admin";

// The transport half of web push: turning a notifications row into a buzz on
// somebody's phone. What to send and to whom is decided long before this file
// (pipeline.ts + targeting.ts); this only carries it.
//
// Uses the admin client because a fan-out reads other people's subscriptions,
// which no single user's RLS permissions allow — the same reason the pipeline
// does (docs/DECISIONS.md, sanctioned uses of the service role).

/** What the service worker's `push` handler expects (public/sw.js). */
export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  /** Groups notifications on the lock screen — the category does nicely. */
  tag?: string;
  urgent?: boolean;
}

// A push payload has about 4KB to play with once encrypted. Announcement
// bodies can be far longer than that, and a lock screen shows two lines
// anyway, so the body is cut here rather than by the phone.
const MAX_BODY = 300;

/**
 * Is push switched on for this deployment?
 *
 * Without the VAPID keys nothing is sent and NOTHING BREAKS: rows are still
 * persisted, the bell still works, and Profile tells people push is not
 * configured rather than offering a switch that does nothing.
 */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY,
  );
}

let configured = false;

function configure(): void {
  if (configured) return;
  webpush.setVapidDetails(
    // A contact address is required by the spec so a push service can report
    // abuse. mailto: or https:, and the fallback is deliberately obvious.
    process.env.WEB_PUSH_CONTACT || "mailto:admin@eendrag.invalid",
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!,
    process.env.WEB_PUSH_PRIVATE_KEY!,
  );
  configured = true;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Push one payload to every device belonging to `profileIds`.
 * Returns how many devices actually took it.
 *
 * Failures never throw: a phone that has been wiped, an endpoint that has
 * expired, or a push service having a bad afternoon must not break the action
 * that triggered the notification. The row is already saved either way.
 */
export async function pushToProfiles(
  profileIds: string[],
  payload: PushPayload,
): Promise<number> {
  if (!isPushConfigured() || profileIds.length === 0) return 0;
  configure();

  const db = createAdminClient();
  const { data: subscriptions, error } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("profile_id", profileIds);
  if (error) {
    console.error("[web-push] could not read subscriptions", error);
    return 0;
  }
  if (!subscriptions || subscriptions.length === 0) return 0;

  const message = JSON.stringify({
    title: payload.title,
    body: (payload.body ?? "").slice(0, MAX_BODY),
    url: payload.url ?? "/",
    tag: payload.tag,
    urgent: payload.urgent ?? false,
  });

  const dead: string[] = [];
  let delivered = 0;

  await Promise.all(
    (subscriptions as SubscriptionRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
          // Urgent posts are worth waking a phone for; everything else can wait
          // for the device to be awake anyway, which saves its battery.
          { urgency: payload.urgent ? "high" : "normal", TTL: 24 * 60 * 60 },
        );
        delivered += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: the browser threw this subscription away (app deleted,
        // notifications revoked, profile wiped). It will never work again, so
        // stop carrying it around.
        if (status === 404 || status === 410) dead.push(sub.id);
        else console.error(`[web-push] send failed (${status ?? "no status"})`, err);
      }
    }),
  );

  if (dead.length > 0) {
    await db.from("push_subscriptions").delete().in("id", dead);
    console.info(`[web-push] pruned ${dead.length} dead subscription(s)`);
  }

  return delivered;
}
