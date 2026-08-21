import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/core/permissions";
import { EmptyState } from "@/core/ui/empty-state";
import { formatLongDate } from "@/core/ui/format";
import { EventForm } from "../components/event-form";
import { PointsForm } from "../components/points-form";
import { SeasonForm } from "../components/season-form";
import { loadCarry, loadCurrentSeason, loadEvents, loadPoints, loadSeasons } from "../lib/load";

export const metadata = { title: "Intersection admin" };

// The intersection admin's front door: the events and the season's points.
// Running a single event happens one level down, at /intersection/admin/[id].
export default async function IntersectionAdminPage() {
  await requireRole("admin");

  const [season, seasons, points] = await Promise.all([
    loadCurrentSeason(),
    loadSeasons(),
    loadPoints(),
  ]);
  // Only this season's events. Past seasons are read-only history — they are
  // reached from the public page, not edited here.
  const [events, carry] = season
    ? await Promise.all([loadEvents(season.id), loadCarry(season.id)])
    : [[], new Map<string, number>()];
  const archived = seasons.filter((s) => s.archivedAt);
  const carriedSections = [...carry.values()].filter((points) => points > 0).length;

  return (
    <div className="space-y-4">
      <Link
        href="/admin"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Admin
      </Link>
      <h1 className="text-2xl font-semibold">Intersection</h1>

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>
            {season ? `Season ${season.name}. ` : ""}Open one to draw it, set times, and enter
            results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState
              title="No events yet"
              description="Create the first one below — touch rugby, chess, five-a-side."
            />
          ) : (
            <ul className="divide-y">
              {events.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/intersection/admin/${event.id}`}
                    className="hover:bg-muted/60 -mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{event.name}</span>
                        <Badge variant="outline">
                          {event.status === "completed"
                            ? "Finished"
                            : event.status === "in_progress"
                              ? "In progress"
                              : "Upcoming"}
                        </Badge>
                      </span>
                      <span className="text-muted-foreground block text-sm">
                        {event.startDate
                          ? formatLongDate(new Date(`${event.startDate}T12:00:00Z`))
                          : "No date set"}
                        {event.groups.length === 0 ? " · no draw yet" : ""}
                      </span>
                    </span>
                    <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New event</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm values={{ name: "", startDate: "", rules: "" }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard points</CardTitle>
          <CardDescription>What each placing is worth across the season.</CardDescription>
        </CardHeader>
        <CardContent>
          <PointsForm values={points} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Season</CardTitle>
          <CardDescription>
            {season
              ? `Running: ${season.name}, started ${formatLongDate(new Date(`${season.startedOn}T12:00:00Z`))}.`
              : "No season is running."}
            {archived.length > 0
              ? ` ${archived.length} past ${archived.length === 1 ? "season" : "seasons"} kept.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {carriedSections > 0 && (
            // The trap this heads off: clearing the events one by one looks
            // like a reset but leaves the carried-over points behind, and the
            // leaderboard stays exactly where it was. Said here, next to the
            // button that actually does it.
            <p className="text-muted-foreground text-sm">
              {carriedSections} sections carry points into {season?.name} from before the app
              was keeping score. Those belong to the season, not to the events — deleting
              every event will <strong>not</strong> clear them and the leaderboard will not
              go back to zero. Starting a new season does both.
            </p>
          )}
          {season ? (
            <SeasonForm currentName={season.name} />
          ) : (
            <p className="text-muted-foreground text-sm">
              No current season — check the database, one row in intersection_seasons should
              have no archived_at.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
