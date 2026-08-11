"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navModules } from "@/modules/registry";

// The tab bar. Derived entirely from the module registry — adding a module
// with navPlacement: "tab" puts it here; nothing in this file changes.
// Bottom bar on phones (nearly all real usage), top bar on desktop.
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
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur sm:sticky sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b"
    >
      <div className="mx-auto flex max-w-3xl items-stretch justify-around sm:justify-start sm:gap-2 sm:px-4">
        {tabs.map((m) => {
          const Icon = m.icon;
          const active = isActive(m.basePath);
          return (
            <Link
              key={m.id}
              href={m.basePath}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 px-3 py-2 text-xs sm:flex-none sm:flex-row sm:gap-2 sm:py-3 sm:text-sm",
                active
                  ? "text-foreground font-medium"
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
