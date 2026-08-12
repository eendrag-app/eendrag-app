import { createAdminClient } from "@/core/db/admin";
import { isPushConfigured, pushToProfiles } from "./web-push";
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

// Web push — the notification that arrives while the app is closed.
//
// Only deliveries that are due right now are sent from here. The rest are
// somebody's quiet hours, and their `deliver_at` is already on the row: the
// cron tick picks those up when the morning comes
// (src/core/notifications/deferred.ts).
//
// Sending is best-effort by design. The rows are saved before this runs, so a
// push service being down costs a buzz, never a notification.
export const webPushChannel: NotificationChannel = {
  id: "web-push",
  async deliver(batch: DeliveryBatch) {
    if (!isPushConfigured()) {
      console.info(
        `[web-push] not configured — "${batch.trigger.title}" reached the bell only. See docs/OPERATIONS.md.`,
      );
      return;
    }

    const now = new Date();
    const due = batch.deliveries.filter((d) => d.deliverAt <= now);
    if (due.length === 0) return;

    await pushToProfiles(
      due.map((d) => d.profileId),
      {
        title: batch.trigger.title,
        body: batch.trigger.body,
        url: batch.trigger.url,
        tag: batch.trigger.category,
        urgent: batch.trigger.urgent,
      },
    );

    // Mark them done whether or not every device took it. A retry would mean
    // re-sending to the phones that DID get it, and a duplicate announcement
    // is worse than a missed buzz for the one phone that was offline — it
    // still has the row waiting in the bell.
    const db = createAdminClient();
    const { error } = await db
      .from("notifications")
      .update({ pushed_at: now.toISOString() })
      .in(
        "id",
        due.map((d) => d.notificationId),
      );
    if (error) console.error("[web-push] could not mark rows as pushed", error);
  },
};

export const channels: NotificationChannel[] = [inAppChannel, webPushChannel];
