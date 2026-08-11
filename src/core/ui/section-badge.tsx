import { cn } from "@/lib/utils";

// A section chip: just the section's name.
//
// It used to carry a coloured dot, from a `sections.color` column phase one
// invented. The res has no section colours, so that column is gone (migration
// 0104) and so is the dot. Sections are told apart by their names, which is
// how the res tells them apart.
export function SectionBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "text-muted-foreground inline-flex h-5 w-fit shrink-0 items-center rounded-4xl border px-2 text-xs font-medium",
        className,
      )}
    >
      {name}
    </span>
  );
}

/**
 * A small coloured dot, for CALENDAR CATEGORIES — res-wide, section, social,
 * sport, intersection. Colours come from `eventCategoryColor`; nothing here
 * encodes which section an event belongs to.
 */
export function ColorDot({
  color,
  className,
  label,
}: {
  color?: string | null;
  className?: string;
  label?: string;
}) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
    />
  );
}
