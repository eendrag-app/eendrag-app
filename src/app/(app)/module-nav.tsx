"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/core/permissions/roles";
import { navModules } from "@/modules/registry";

// The tab bar. Derived entirely from the module registry — adding a module
// with navPlacement: "tab" puts it here; nothing in this file changes. The
// signed-in role comes from the layout so that role-restricted tabs (Admin)
// can be filtered out server-side, before any of this reaches a student.
//
// ONE element, two layouts: on phones it is `fixed` to the bottom of the
// viewport (so its position in the DOM does not matter, and it can live inside
// the header), on desktop it becomes a normal row inside the header. One
// element also means one `aria-label="Main"` landmark.
//
// Because of the `fixed`, no ancestor may have a transform, filter, or
// backdrop-filter — any of those would become the containing block and drag
// the tab bar up into the header. See the comment in (app)/layout.tsx.
export function ModuleNav({ role }: { role: Role | null }) {
  const pathname = usePathname();
  const tabs = navModules(role);

  function isActive(basePath: string) {
    return basePath === "/"
      ? pathname === "/"
      : pathname === basePath || pathname.startsWith(basePath + "/");
  }

  return (
    <nav
      aria-label="Main"
      className="bg-card/95 supports-[backdrop-filter]:bg-card/85 border-gold fixed inset-x-0 bottom-0 z-50 border-t-2 backdrop-blur sm:static sm:z-auto sm:ml-2 sm:border-t-0 sm:bg-transparent sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent"
    >
      <div className="mx-auto flex max-w-3xl items-stretch justify-around pb-[env(safe-area-inset-bottom)] sm:justify-start sm:gap-1 sm:pb-0">
        {tabs.map((m) => {
          const Icon = m.icon;
          const active = isActive(m.basePath);
          return (
            <Link
              key={m.id}
              href={m.basePath}
              aria-label={m.name}
              aria-current={active ? "page" : undefined}
              className={cn(
                // min-h-14 keeps the touch target comfortably over 44px. The
                // phone bar is tight on padding and type because six tabs
                // share 360px; the desktop row can breathe.
                "flex min-w-0 min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] sm:min-h-0 sm:flex-none sm:flex-row sm:gap-1.5 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-sm",
                // Two surfaces, two active states: on a phone the bar sits on
                // the page, so the active tab is simply the res colour; on
                // desktop it sits on the maroon header, so the active tab is
                // the cream pill the Intersection app uses.
                active
                  ? "text-primary font-semibold sm:bg-background sm:text-primary dark:sm:bg-primary/15"
                  : "text-muted-foreground hover:text-foreground sm:text-header-muted sm:hover:text-header-foreground",
              )}
            >
              <Icon className="size-5 sm:size-4" aria-hidden />
              {/* Short label where six tabs share a phone's width, the full
                  one everywhere else. The link's aria-label is always the
                  full name, so this is purely visual. */}
              <span className="max-w-full truncate sm:hidden">{m.shortName ?? m.name}</span>
              <span className="hidden sm:inline">{m.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
