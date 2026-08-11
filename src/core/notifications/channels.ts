import type { DeliveryBatch, NotificationChannel } from "./types";

// Delivery channels. The notifications table is the source of truth — the
// pipeline persists rows first, then hands the batch to every channel here.

// In-app: the bell with the unread badge reads the notifications table
// directly, so persistence *is* delivery. This channel exists so the channel
// list is honest about where in-app delivery happens.
export const inAppChannel: NotificationChannel = {
  id: "in-app",
  async deliver() {
    // Nothing to do: rows are already persisted and the bell polls/subscribes.
  },
};

// Web push — STUB. The interface is final; only the body is missing.
// Implementing it (v1.1) means:
//   1. `npm install web-push`, generate VAPID keys (`npx web-push
//      generate-vapid-keys`), put them in .env.local / Vercel env
//      (WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY).
//   2. A push_subscriptions table (profile_id, endpoint, keys jsonb) with
//      RLS "own rows only", plus a service worker + subscribe button in
//      Profile → Notification settings.
//   3. Here: for each delivery where deliverAt <= now, look up the
//      recipient's subscriptions and webpush.sendNotification(); honour
//      deliverAt for the rest (a cron route re-runs delivery for deferred
//      rows — see docs/ARCHITECTURE.md → Notifications).
// Until then this channel logs and returns; the in-app bell still works.
export const webPushChannel: NotificationChannel = {
  id: "web-push",
  async deliver(batch: DeliveryBatch) {
    console.info(
      `[web-push stub] would deliver "${batch.trigger.title}" to ${batch.deliveries.length} recipient(s)`,
    );
  },
};

export const channels: NotificationChannel[] = [inAppChannel, webPushChannel];
