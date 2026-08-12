import Link from "next/link";
import { ChevronRight, Crown, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfile } from "@/core/permissions";
import { EmptyState } from "@/core/ui/empty-state";
import { formatDateTime, formatLongDate } from "@/core/ui/format";
import { cn } from "@/lib/utils";
import { teamsLabel } from "../lib/copy";
import { loadEvents, loadPoints, loadSections } from "../lib/load";
import { leaderboard, placements } from "../lib/tournament";

export const metadata = { title: "Intersection" };

// PUBLIC. Nothing on this page requires a session: fixture links get pasted
// into WhatsApp and have to open for anyone. The module declares
// requiresAuth: false and RLS lets anon read the intersection tables; writes
// are admin-only.
export default async function IntersectionPage() {
  // Signed out (which this page must work for) simply means no highlight.
  const [events, sections, points, profile] = await Promise.all([
    loadEvents(),
    loadSections(),
    loadPoints(),
    getProfile(),
  ]);
  const mySectionId = profile?.section_id ?? null;
  const nameOf = (id: string) => sections.find((s) => s.id === id)?.name ?? "Unknown";

  const completed = events.filter((event) => event.status === "completed");
  const table = leaderboard(sections, completed, points);
  const anyPoints = table.some((row) => row.points > 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Intersection</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4" aria-hidden />
            Leaderboard
          </CardTitle>
          <CardDescription>
            Points across every finished event: {points.champion} for winning it,{" "}
            {points.runnerUp} runner-up, {points.semis} semis, {points.quarters} quarters,{" "}
            {points.group} for the group stage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!anyPoints ? (
            <p className="text-muted-foreground text-sm">
              No event has been played out yet — the table fills up as soon as one has a
              champion.
            </p>
          ) : (
            <ol className="divide-y">
              {table.map((row, index) => {
                const mine = row.sectionId === mySectionId;
                return (
                <li
                  key={row.sectionId}
                  className={cn(
                    "flex items-center gap-3 py-2",
                    // Your own section, findable at a glance in a table of 12.
                    mine && "bg-primary/8 -mx-2 rounded-lg px-2",
                  )}
                >
                  <span className="text-muted-foreground w-6 text-sm tabular-nums">
                    {index + 1}
                  </span>
                  <span className={cn("flex-1 text-sm font-medium", mine && "text-primary")}>
                    {row.name}
                    {mine && <span className="sr-only"> (your section)</span>}
                  </span>
                  {row.eventsWon > 0 && (
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
                      <Crown className="size-3.5" aria-hidden />
                      {row.eventsWon}
                    </span>
                  )}
                  <span className="w-10 text-right text-sm font-semibold tabular-nums">
                    {row.points}
                  </span>
                </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Events</h2>
        <Link
          href="/intersection/players"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <Users className="size-4" aria-hidden />
          Player stats
        </Link>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No events yet"
          description="The HK sets them up — touch rugby, chess, five-a-side, whatever the year brings."
        />
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const champion =
              event.status === "completed"
                ? [...(placements(event.groups, event.matches) ?? new Map())].find(
                    ([, tier]) => tier === "champion",
                  )?.[0]
                : null;
            const next = event.matches.find((m) => !m.played && m.scheduledAt);
            return (
              <Card key={event.id} className="hover:bg-muted/40">
                <CardContent>
                  <Link href={`/intersection/events/${event.id}`} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{event.name}</span>
                        <Badge variant={event.status === "completed" ? "secondary" : "outline"}>
                          {event.status === "completed"
                            ? "Finished"
                            : event.status === "in_progress"
                              ? "In progress"
                              : "Upcoming"}
                        </Badge>
                      </span>
                      {event.startDate && (
                        <span className="text-muted-foreground block text-sm">
                          {formatLongDate(new Date(`${event.startDate}T12:00:00Z`))}
                        </span>
                      )}
                      {champion && (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Crown className="size-3.5" aria-hidden />
                          {nameOf(champion)} won it
                        </span>
                      )}
                      {!champion && next && (
                        <span className="text-muted-foreground block text-sm">
                          Next: {teamsLabel(next, nameOf)}
                          {next.scheduledAt ? ` · ${formatDateTime(next.scheduledAt)}` : ""}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
