// Notification categories. Each maps 1:1 to a toggle in Profile → Notification
// settings and to notification_preferences.category in the database.
//
// - announcement: a new announcement was published
// - urgent:       urgent announcements — bypasses quiet hours, cannot be
//                 disabled by the "announcement" toggle alone
// - calendar:     an event you can see was added or changed
// - intersection: your section's fixtures, reminders, and results
// - sport:        practice/venue changes for sports you play
// - section:      "section-only" filter — when on, res-wide noise is reduced
//                 to things involving your section
export const NOTIFICATION_CATEGORIES = [
  "announcement",
  "urgent",
  "calendar",
  "intersection",
  "sport",
  "section",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
