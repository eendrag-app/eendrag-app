import { Dumbbell } from "lucide-react";
import type { AppModule } from "@/modules/types";

const sportModule: AppModule = {
  id: "sport",
  name: "Sport",
  icon: Dumbbell,
  navPlacement: "tab",
  order: 20,
  basePath: "/sport",
  requiresAuth: true,
  notificationCategories: ["sport"],
  adminPanels: [
    {
      id: "sport-manage",
      title: "Sports & reps",
      description: "Add sports, assign reps, edit practice times and venues",
      href: "/sport/admin",
      roles: ["admin"],
    },
  ],
  calendarSource: true,
};

export default sportModule;
