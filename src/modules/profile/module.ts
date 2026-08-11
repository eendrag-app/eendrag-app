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
  // adminPanels). It emits no notifications of its own.
};

export default profileModule;
