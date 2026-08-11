// Public API of the notification core. Modules import from here only:
//
//   import { notify } from "@/core/notifications";
//
//   await notify({
//     category: "sport",
//     title: "Hockey practice moved to 20:00",
//     url: "/sport/hockey",
//     sourceModule: "sport",
//     sourceRef: fixtureId,
//     audience: { kind: "sport", sportId },
//   });
//
// See docs/HANDOFF.md → Notifications for the full trigger catalogue.
export { notify } from "./pipeline";
export { NOTIFICATION_CATEGORIES, type NotificationCategory } from "./categories";
export type {
  Audience,
  NotificationTrigger,
  RecipientCandidate,
  NotificationChannel,
  DeliveryBatch,
} from "./types";
export { resolveRecipients, preferenceEnabled } from "./targeting";
export { isInQuietHours, deliveryTime } from "./quiet-hours";
