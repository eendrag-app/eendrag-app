import Link from "next/link";
import { CalendarDays, ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { requireRole } from "@/core/permissions";
import { EmptyState } from "@/core/ui/empty-state";
import { dayKey, formatDateTime, formatTime } from "@/core/ui/format";
import { EventAdminList, type AdminEvent } from "../components/event-admin-list";

export const metadata = { title: "Calendar" };

// Everything from a month ago onwards: far enough back to fix a typo in last
// week's event, not so far that the list becomes an archive. The month grid
// pages through the same rows, so flicking back a month costs nothing.
const PAST_DAYS = 30;

export default async function CalendarAdminPage() {
  await requireRole("admin");
  const db = await createClient();

  const from = new Date(new Date().getTime() - PAST_DAYS * 86_400_000).toISOString();
  const { data } = await db
    .from("events")
    .select("id, title, category, location, starts_at, source_module, section:sections(name)")
    .gte("starts_at", from)
    .order("starts_at")
    .limit(400);

  const items: AdminEvent[] = (data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    whenLabel: formatDateTime(e.starts_at),
    dayKey: dayKey(e.starts_at),
    timeLabel: formatTime(e.starts_at),
    location: e.location,
    sectionName: e.section?.name ?? null,
    sourceModule: e.source_module,
  }));
  // "Today" is decided on the server: res time, one answer, no hydration
  // mismatch between a phone in Stellenbosch and one on exchange.
  const todayKey = dayKey(new Date());

  return (
    <div className="space-y-4">
      <Link
        href="/admin"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Admin
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <Button
          size="lg"
          className="h-11"
          nativeButton={false}
          render={<Link href="/calendar/admin/new" />}
        >
          <Plus aria-hidden />
          New event
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What is on</CardTitle>
          <CardDescription>
            Tap a day to see it, edit it or add to it. Sport fixtures and intersection games
            put themselves here — never add those by hand, they would just appear twice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nothing on the calendar"
              description="Add the next huisvergadering, sokkie or deadline and everyone sees it."
            />
          ) : (
            <EventAdminList items={items} todayKey={todayKey} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
