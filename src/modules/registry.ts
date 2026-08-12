// THE registration point. One import + one array entry per module — that is
// the entire registration step. Navigation, the notification-settings UI, and
// the Admin tab all derive from this array; nothing module-shaped is
// hardcoded anywhere else. See docs/ADDING-A-MODULE.md.
import type { AppModule } from "@/modules/types";
import type { Role } from "@/core/permissions/roles";
import home from "@/modules/home/module";
import calendar from "@/modules/calendar/module";
import sport from "@/modules/sport/module";
import intersection from "@/modules/intersection/module";
import admin from "@/modules/admin/module";
import profile from "@/modules/profile/module";
import template from "@/modules/_template/module";

export const modules: AppModule[] = [
  home,
  calendar,
  sport,
  intersection,
  admin,
  profile,
  template,
];

/**
 * Modules shown in the tab bar, in display order.
 *
 * `role` is the signed-in user's role, or null when signed out. A module that
 * declares `roles` only appears for those roles — that is what keeps the Admin
 * tab off a student's screen. It is a convenience, not a gate: the pages
 * themselves call requireRole and RLS refuses the writes regardless.
 */
export function navModules(role: Role | null): AppModule[] {
  return modules
    .filter((m) => m.navPlacement === "tab")
    .filter((m) => !m.roles || (role !== null && m.roles.includes(role)))
    .sort((a, b) => a.order - b.order);
}

/** Look a module up by id. Throws — a typo'd id is a build-time bug, not a runtime state. */
export function getModule(id: string): AppModule {
  const m = modules.find((m) => m.id === id);
  if (!m) throw new Error(`Unknown module "${id}" — is it listed in src/modules/registry.ts?`);
  return m;
}

/** Every admin panel across all modules, for the Admin tab. */
export function allAdminPanels() {
  return modules.flatMap((m) => m.adminPanels ?? []);
}

/** Every notification category any module emits, for the settings UI. */
export function allNotificationCategories() {
  return [...new Set(modules.flatMap((m) => m.notificationCategories ?? []))];
}

/** The module owning a pathname, longest basePath first ("/" matches last). */
export function moduleForPath(pathname: string): AppModule | undefined {
  return [...modules]
    .sort((a, b) => b.basePath.length - a.basePath.length)
    .find((m) =>
      m.basePath === "/"
        ? pathname === "/"
        : pathname === m.basePath || pathname.startsWith(m.basePath + "/"),
    );
}
