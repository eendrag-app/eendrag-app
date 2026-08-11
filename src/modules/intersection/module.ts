import { Trophy } from "lucide-react";
import type { AppModule } from "@/modules/types";

const intersectionModule: AppModule = {
  id: "intersection",
  name: "Intersection",
  icon: Trophy,
  navPlacement: "tab",
  order: 30,
  basePath: "/intersection",
  // Publicly viewable on purpose: fixture links get pasted into WhatsApp and
  // must open without a login wall. Writes still require an admin (RLS).
  requiresAuth: false,
  notificationCategories: ["intersection"],
  adminPanels: [
    {
      id: "intersection-manage",
      title: "Intersection",
      description: "Events, draws, results, rosters, leaderboard points",
      href: "/intersection/admin",
      roles: ["admin"],
    },
  ],
  calendarSource: true,
};

export default intersectionModule;
