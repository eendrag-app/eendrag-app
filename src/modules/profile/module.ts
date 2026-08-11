import { User } from "lucide-react";
import type { AppModule } from "@/modules/types";

const profileModule: AppModule = {
  id: "profile",
  name: "Profile",
  icon: User,
  navPlacement: "tab",
  order: 40,
  basePath: "/profile",
  requiresAuth: true,
  // Profile hosts the notification-settings UI (built from every module's
  // notificationCategories) and the Admin list (built from every module's
  // adminPanels). It sends no notifications of its own — but it does own the
  // "section-only mode" filter, which is a preference about *all* categories
  // rather than something any feature module emits. Declaring it here is what
  // puts its switch on the settings page without hardcoding a category
  // anywhere (docs/DECISIONS.md, 2026-08-11).
  notificationCategories: ["section"],
  adminPanels: [
    {
      id: "profile-members",
      title: "Members",
      description: "Roles, and deactivating people who leave the res",
      href: "/profile/members",
      roles: ["admin"],
    },
  ],
};

export default profileModule;
