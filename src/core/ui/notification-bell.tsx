"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  markAllNotificationsRead,
  markNotificationRead,
  refreshInbox,
} from "./inbox-actions";
import type { Inbox, InboxItem } from "./inbox";

// The bell lives in the app shell, not in a module: every module's
// notifications land in the same list. It polls a server action every 60
// seconds — boring, good enough for 280 users, and no realtime subscription to
// debug at 2am (docs/HANDOFF.md → Profile → The bell).

const POLL_MS = 60_000;

export function NotificationBell({ initial }: { initial: Inbox }) {
  const [inbox, setInbox] = useState(initial);
  const [serverInbox, setServerInbox] = useState(initial);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Keep the badge honest while the page stays open.
  useEffect(() => {
    const timer = setInterval(() => {
      void refreshInbox().then(setInbox);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  // A fresh server render (navigation, router.refresh()) wins over whatever
  // the last poll left behind. Adjusting state during render is React's
  // documented way to do this — cheaper than an effect, and it never shows the
  // stale value (https://react.dev/reference/react/useState).
  if (serverInbox !== initial) {
    setServerInbox(initial);
    setInbox(initial);
  }

  async function openItem(item: InboxItem) {
    setInbox((prev) => ({
      unread: item.read ? prev.unread : Math.max(0, prev.unread - 1),
      items: prev.items.map((i) => (i.id === item.id ? { ...i, read: true } : i)),
    }));
    setOpen(false);
    if (!item.read) await markNotificationRead(item.id);
    router.push(item.url);
    router.refresh();
  }

  async function markAll() {
    setInbox((prev) => ({
      unread: 0,
      items: prev.items.map((i) => ({ ...i, read: true })),
    }));
    await markAllNotificationsRead();
    router.refresh();
  }

  const label =
    inbox.unread > 0 ? `Notifications, ${inbox.unread} unread` : "Notifications";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon-lg" className="relative" />}
        aria-label={label}
      >
        <Bell className="size-5" aria-hidden />
        {inbox.unread > 0 && (
          <span className="bg-destructive text-background absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold">
            {inbox.unread > 9 ? "9+" : inbox.unread}
          </span>
        )}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[80dvh] gap-0 rounded-t-xl p-0 sm:max-w-lg"
      >
        <SheetHeader className="flex-row items-center justify-between border-b">
          <SheetTitle>Notifications</SheetTitle>
          {inbox.unread > 0 && (
            <Button variant="ghost" size="sm" className="mr-9" onClick={markAll}>
              Mark all read
            </Button>
          )}
        </SheetHeader>
        <div className="overflow-y-auto">
          {inbox.items.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-12 text-center text-sm">
              <BellOff className="size-6 opacity-60" aria-hidden />
              <p>Nothing yet. Announcements, fixtures and results land here.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {inbox.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className="hover:bg-muted/60 flex w-full items-start gap-3 px-4 py-3 text-left"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        item.read
                          ? "bg-transparent"
                          : item.category === "urgent"
                            ? "bg-destructive"
                            : "bg-primary",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-sm",
                          item.read ? "text-muted-foreground" : "font-medium",
                        )}
                      >
                        {item.title}
                      </span>
                      {item.body && (
                        <span className="text-muted-foreground line-clamp-2 block text-sm">
                          {item.body}
                        </span>
                      )}
                      <span className="text-muted-foreground block text-xs">
                        {item.timeLabel}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
