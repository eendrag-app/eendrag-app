import { ShieldCheck } from "lucide-react";
import type { AppModule } from "@/modules/types";

// The way in to every module's admin surface. It was a card at the bottom of
// Profile until 2026-08-12; the HK runs the res from a phone and should not
// have to scroll past their own quiet hours to publish an announcement
// (docs/DECISIONS.md).
//
// This module owns NO admin screens of its own. It renders the list of
// `adminPanels` every other module declares, which is why adding an admin page
// to a module still means editing exactly one file — that module's module.ts.
//
// `roles` is what keeps the tab off a student's screen: the nav filters by it.
// It is a convenience, not a gate — every admin page calls requireRole and RLS
// refuses the writes regardless.
const adminModule: AppModule = {
  id: "admin",
  name: "Admin",
  icon: ShieldCheck,
  navPlacement: "tab",
  order: 35, // last but one, just before Profile
  basePath: "/admin",
  requiresAuth: true,
  roles: ["admin", "sport_rep"],
};

export default adminModule;
