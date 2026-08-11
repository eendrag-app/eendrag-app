import type { LucideIcon } from "lucide-react";
import type { Role } from "@/core/permissions/roles";
import type { NotificationCategory } from "@/core/notifications/categories";

// An admin surface a module contributes to Profile → Admin. The module owns
// the page at `href`; the Profile module only lists and links it.
export interface AdminPanel {
  id: string; // unique across the app, e.g. "sport-manage"
  title: string; // "Manage sports"
  description: string; // one line shown under the title
  href: string; // route the panel lives at, e.g. "/sport/admin"
  roles: Role[]; // who sees the link (the page must ALSO check — RLS is the real gate)
}

// The module contract. Every folder under src/modules (except _template until
// you copy it) default-exports one of these from its module.ts and is listed
// in src/modules/registry.ts. Navigation, notification settings, and the
// Profile → Admin list all derive from the registry — nothing is hardcoded
// elsewhere. See docs/ADDING-A-MODULE.md for the full recipe.
export interface AppModule {
  id: string; // "sport" — also the migration filename tag and folder name
  name: string; // "Sport" — shown in nav
  icon: LucideIcon;
  navPlacement: "tab" | "hidden"; // "hidden" = routable but not in the tab bar
  order: number; // tab order, ascending
  basePath: string; // "/sport" — must match the route folder under src/app/(app)
  requiresAuth: boolean; // false = publicly viewable (intersection); writes still need auth
  roles?: Role[]; // omit = visible to every signed-in user
  notificationCategories?: NotificationCategory[]; // categories this module emits
  adminPanels?: AdminPanel[];
  calendarSource?: boolean; // true = writes to the shared events table via src/core/calendar
}
