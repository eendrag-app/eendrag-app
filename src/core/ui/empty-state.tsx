import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Empty states are written for students, not for developers: say what is
// missing and what happens next ("No fixtures yet — check back after the rep
// posts the schedule"), never a bare "No data".
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center text-sm",
        className,
      )}
    >
      {Icon && <Icon className="size-6 opacity-60" aria-hidden />}
      <p className="text-foreground font-medium">{title}</p>
      {description && <p className="max-w-prose">{description}</p>}
      {children}
    </div>
  );
}
