import { ModuleNav } from "./module-nav";

// The app shell: registry-derived nav + a phone-width content column.
// Auth gating per module (AppModule.requiresAuth) is wired up together with
// src/core/auth — see docs/BUILD-LOG.md for current status.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <ModuleNav />
      <main className="mx-auto max-w-3xl px-4 pt-4 pb-20 sm:pb-8">{children}</main>
    </div>
  );
}
