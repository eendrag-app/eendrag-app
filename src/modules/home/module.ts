import { Home } from "lucide-react";
import type { AppModule } from "@/modules/types";

const homeModule: AppModule = {
  id: "home",
  name: "Home",
  icon: Home,
  navPlacement: "tab",
  order: 10,
  basePath: "/",
  requiresAuth: true,
  notificationCategories: ["announcement", "urgent", "calendar"],
  adminPanels: [
    {
      id: "home-announcements",
      title: "Announcements",
      description: "Compose, schedule, and target announcements; see open counts",
      href: "/admin/announcements",
      roles: ["admin"],
    },
    {
      id: "home-calendar",
      title: "Calendar",
      description: "Add and edit res-wide, section, and social events",
      href: "/admin/calendar",
      roles: ["admin"],
    },
  ],
  calendarSource: true,
};

export default homeModule;
