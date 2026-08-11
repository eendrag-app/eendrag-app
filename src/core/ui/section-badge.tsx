import { cn } from "@/lib/utils";

// A section-coded chip: neutral text with the section's own colour as a dot.
//
// Why not colour the text or the background? Because the twelve section
// colours come from the database (HK can change them) and none of them is
// guaranteed to be readable on the card surface — in dark mode especially.
// A dot is always legible, and the same rule keeps calendar dots and
// leaderboard rows consistent (docs/HANDOFF.md → design direction).
export function SectionBadge({
  name,
  color,
  className,
}: {
  name: string;
  color?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-muted-foreground inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-4xl border px-2 text-xs font-medium",
        className,
      )}
    >
      <ColorDot color={color} />
      {name}
    </span>
  );
}

/** The coloured dot on its own — calendar cells, leaderboard rows, fixtures. */
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
