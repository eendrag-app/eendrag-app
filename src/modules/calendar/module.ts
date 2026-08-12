import { CalendarDays } from "lucide-react";
import type { AppModule } from "@/modules/types";

// The shared calendar. It was a column beside the feed on the home page until
// 2026-08-12, when the HK pointed out the obvious: on a busy week you have to
// scroll past every announcement to find out what is on tonight. It is its own
// tab now (docs/DECISIONS.md).
//
// It owns the *admin-created* events — huisvergaderings, sokkies, deadlines.
// Sport fixtures and intersection games are mirrored into the same table by
// their own modules through @/core/calendar, which is why this UI shows them
// but refuses to edit them.
const calendarModule: AppModule = {
  id: "calendar",
  name: "Calendar",
  icon: CalendarDays,
  navPlacement: "tab",
  order: 15, // between Home (10) and Sport (20)
  basePath: "/calendar",
  requiresAuth: true,
  notificationCategories: ["calendar"],
  adminPanels: [
    {
      id: "calendar-manage",
      title: "Calendar",
      description: "Add and edit res-wide, section, and social events",
      href: "/calendar/admin",
      roles: ["admin"],
    },
  ],
  calendarSource: true,
};

export default calendarModule;
