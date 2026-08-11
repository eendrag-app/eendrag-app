import type { NotificationCategory } from "@/core/notifications";

// Plain-language copy for the notification switches. The *list* of switches
// comes from the registry (`allNotificationCategories()`), so a new module
// that emits a new category gets a switch for free — it only needs a line
// here. A category with no copy still renders, using its id, so forgetting
// this file degrades to ugly rather than broken.
//
// Nothing here promises push notifications: until v1.1 these toggles control
// what reaches the in-app bell (docs/BUILD-LOG.md → web push).

export interface CategoryCopy {
  label: string;
  description: string;
}

export const CATEGORY_COPY: Partial<Record<NotificationCategory, CategoryCopy>> = {
  announcement: {
    label: "Announcements",
    description: "New posts from the HK on the home feed.",
  },
  urgent: {
    label: "Urgent announcements",
    description: "Water off, safety, same-day deadlines. These ignore quiet hours.",
  },
  calendar: {
    label: "Calendar",
    description: "New or changed events you can see.",
  },
  intersection: {
    label: "Intersection",
    description: "Your section's fixtures and results in the inter-section competition.",
  },
  sport: {
    label: "Sport",
    description: "Practice, venue and fixture changes for the sports you play.",
  },
  section: {
    label: "Only notify me about my section",
    description:
      "A noise filter, off by default: when it is on, anything that is not about your section is skipped. Urgent announcements still come through.",
  },
};

export function categoryCopy(category: NotificationCategory | string): CategoryCopy {
  return (
    CATEGORY_COPY[category as NotificationCategory] ?? {
      label: category,
      description: "",
    }
  );
}
