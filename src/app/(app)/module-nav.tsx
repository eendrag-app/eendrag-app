"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navModules } from "@/modules/registry";

// The tab bar. Derived entirely from the module registry — adding a module
// with navPlacement: "tab" puts it here; nothing in this file changes.
//
// ONE element, two layouts: on phones it is `fixed` to the bottom of the
// viewport (so its position in the DOM does not matter, and it can live inside
// the header), on desktop it becomes a normal row inside the header. One
// element also means one `aria-label="Main"` landmark.
export function ModuleNav() {
  const pathname = usePathname();
  const tabs = navModules();

  function isActive(basePath: string) {
    return basePath === "/"
      ? pathname === "/"
      : pathname === basePath || pathname.startsWith(basePath + "/");
  }

  return (
    <nav
      aria-label="Main"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur sm:static sm:z-auto sm:ml-2 sm:border-t-0 sm:bg-transparent sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent"
    >
      <div className="mx-auto flex max-w-3xl items-stretch justify-around pb-[env(safe-area-inset-bottom)] sm:justify-start sm:gap-1 sm:pb-0">
        {tabs.map((m) => {
          const Icon = m.icon;
          const active = isActive(m.basePath);
          return (
            <Link
              key={m.id}
              href={m.basePath}
              aria-current={active ? "page" : undefined}
              className={cn(
                // min-h-14 keeps the touch target comfortably over 44px.
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-3 text-xs sm:min-h-0 sm:flex-none sm:flex-row sm:gap-1.5 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-sm",
                active
                  ? "text-foreground font-medium sm:bg-muted"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5 sm:size-4" aria-hidden />
              {m.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
