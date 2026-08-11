import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { requireRole } from "@/core/permissions";
import { EmptyState } from "@/core/ui/empty-state";
import { formatLongDate } from "@/core/ui/format";
import { EventForm } from "../components/event-form";
import type { SectionOption } from "../components/match-admin";
import { PlayersAdmin, type AdminPlayer } from "../components/players-admin";
import { PointsForm } from "../components/points-form";
import { loadEvents, loadPoints, loadSections } from "../lib/load";

export const metadata = { title: "Intersection admin" };

// The intersection admin's front door: the events, the season's points, and
// the player list the rosters draw from. Running a single event happens one
// level down, at /intersection/admin/[id].
export default async function IntersectionAdminPage() {
  await requireRole("admin");
  const db = await createClient();

  const [events, sections, points, players, accounts] = await Promise.all([
    loadEvents(),
    loadSections(),
    loadPoints(),
    db
      .from("intersection_players")
      .select("id, name, section_id, profile_id")
      .order("name"),
    db
      .from("profiles")
      .select("id, full_name, email, section_id")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const sectionOptions: SectionOption[] = sections;
  const playerRows: AdminPlayer[] = (players.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sectionId: p.section_id,
    linked: p.profile_id !== null,
  }));

  return (
    <div className="space-y-4">
      <Link
        href="/profile"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Profile
      </Link>
      <h1 className="text-2xl font-semibold">Intersection</h1>

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>
            Open one to draw it, set times, and enter results.
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
          <CardTitle>Players</CardTitle>
          <CardDescription>
            Everyone who might be on a roster. Linking a player to an account means their
            name follows whatever they set in Profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlayersAdmin
            players={playerRows}
            sections={sectionOptions}
            accounts={(accounts.data ?? []).map((a) => ({
              id: a.id,
              label: a.full_name || a.email,
              sectionId: a.section_id,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
