import Link from "next/link";
import { loadInbox } from "@/core/ui/inbox";
import { NotificationBell } from "@/core/ui/notification-bell";
import { ThemeToggle } from "@/core/ui/theme";
import { getProfile, type Role } from "@/core/permissions";
import { ModuleNav } from "./module-nav";

// The app shell: a sticky header (wordmark, registry-derived nav on desktop,
// bell, appearance) over a phone-width content column. On phones the nav is
// pinned to the bottom of the screen instead — see module-nav.tsx.
//
// The shell is shared with public pages (/intersection has requiresAuth:
// false), so everything user-specific degrades to nothing when signed out.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getProfile();
  const inbox = profile ? await loadInbox() : null;

  return (
    <div className="min-h-dvh">
      {/* The res bar: maroon in the light, near-black in the dark, with the
          gold hairline the Intersection app has always had under it.

          Solid background, NO backdrop-blur here: a backdrop-filter makes an
          element the containing block for `position: fixed` descendants, and
          the tab bar inside is fixed to the bottom of the screen on phones.
          Blurring here pins it to the bottom of the header instead. */}
      <header className="bg-header text-header-foreground border-gold sticky top-0 z-40 border-b-2">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link
            href="/"
            className="font-heading text-base font-bold tracking-[0.14em] uppercase"
          >
            Eendrag
          </Link>
          <ModuleNav role={(profile?.role as Role | undefined) ?? null} />
          <div className="on-header ml-auto flex items-center gap-0.5">
            {inbox ? (
              <NotificationBell initial={inbox} />
            ) : (
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium">
                Sign in
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-4 pb-24 sm:pb-10">{children}</main>
    </div>
  );
}
