import type { EventCategory } from "@/core/calendar";

// Calendar colour discipline, defined ONCE (docs/HANDOFF.md → design
// direction). The neutral palette does almost everything; these colours only
// ever tint a dot or a badge, never a surface.
//
//   res_wide     the primary token
//   section      the section's own colour, from sections.color
//   intersection violet
//   social       pink
//   sport        emerald
//
// The CSS variables live in src/app/globals.css so light and dark can differ.
// `sectionColor` is only consulted for the "section" category.

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  res_wide: "Res-wide",
  section: "Section",
  intersection: "Intersection",
  social: "Social",
  sport: "Sport",
};

export const EVENT_CATEGORIES = Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[];

/** A CSS colour for the category's dot/badge — pass to `style={{ color }}`. */
export function eventCategoryColor(
  category: EventCategory | string,
  sectionColor?: string | null,
): string {
  switch (category) {
    case "section":
      return sectionColor ?? "var(--event-section)";
    case "intersection":
      return "var(--event-intersection)";
    case "social":
      return "var(--event-social)";
    case "sport":
      return "var(--event-sport)";
    default:
      return "var(--event-res-wide)";
  }
}

export function eventCategoryLabel(category: EventCategory | string): string {
  return EVENT_CATEGORY_LABELS[category as EventCategory] ?? category;
}
