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
  notificationCategories: ["announcement", "urgent"],
  adminPanels: [
    {
      id: "home-announcements",
      title: "Announcements",
      description: "Compose, schedule, and target announcements; see open counts",
      href: "/admin/announcements",
      roles: ["admin"],
    },
  ],
};

export default homeModule;
