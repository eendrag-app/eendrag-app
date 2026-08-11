import { Sparkles } from "lucide-react";
import type { AppModule } from "@/modules/types";

// The template module IS registered (hidden from the tab bar) so that it
// provably works end to end: visit /template on a running dev server.
// When you copy this folder to start a real module, leave this original
// alone — it doubles as a living smoke test of the module system.
const templateModule: AppModule = {
  id: "template",
  name: "Template",
  icon: Sparkles,
  navPlacement: "hidden",
  order: 999,
  basePath: "/template",
  requiresAuth: true,
};

export default templateModule;
