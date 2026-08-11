import type { NotificationCategory } from "./categories";
import type { Role } from "@/core/permissions/roles";

// Who a notification is aimed at. Targeting resolves an audience into
// concrete recipients (see targeting.ts — pure and heavily tested).
export type Audience =
  | { kind: "all" } // every active user
  | { kind: "section"; sectionId: string } // everyone in one section
  | { kind: "sport"; sportId: string } // everyone who plays a sport
  | { kind: "role"; role: Role }; // e.g. all admins

// What a module hands to notify(). One trigger fans out into one
// notifications row per resolved recipient.
export interface NotificationTrigger {
  category: NotificationCategory;
  title: string;
  body?: string;
  url?: string; // in-app deep link, e.g. "/sport/hockey"
  sourceModule: string; // module id, e.g. "sport"
  sourceRef?: string; // module-defined reference, e.g. a fixture id
  audience: Audience;
  // Urgent notifications ignore quiet hours and the category toggle can only
  // be silenced via the dedicated 'urgent' toggle. Only announcements marked
  // urgent by HK should set this.
  urgent?: boolean;
  // The section this notification is "about" (result involving Katstraat,
  // fixture for Ingang, ...). Used by section-only mode even when the
  // audience is res-wide. Omit when nothing section-specific applies.
  aboutSectionId?: string;
}

// Everything targeting needs to know about one potential recipient. The
// pipeline builds these from profiles + notification_preferences +
// user_sports; tests build them by hand.
export interface RecipientCandidate {
  profileId: string;
  sectionId: string | null;
  role: Role;
  isActive: boolean;
  sportIds: string[]; // sports this user plays (user_sports)
  // category -> enabled. Missing categories fall back to the default:
  // enabled for everything except 'section' (section-only mode is opt-in).
  preferences: Partial<Record<NotificationCategory, boolean>>;
  quietHoursStart: string; // "23:00" (as stored on profiles)
  quietHoursEnd: string; // "07:00"
}

// A channel delivers an already-persisted notification. The rows in the
// notifications table are the source of truth; channels are how they reach
// the user's attention. See channels.ts.
export interface NotificationChannel {
  id: string;
  // Called once per recipient batch after rows are persisted. deliverAt is
  // now() unless quiet hours deferred it (urgent is never deferred).
  deliver(batch: DeliveryBatch): Promise<void>;
}

export interface DeliveryBatch {
  trigger: NotificationTrigger;
  deliveries: Array<{
    profileId: string;
    notificationId: string;
    deliverAt: Date; // now, or the end of the recipient's quiet hours
  }>;
}
