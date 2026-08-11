import Link from "next/link";
import { ChevronLeft, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { EmptyState } from "@/core/ui/empty-state";
import { loadEvents, loadSections } from "../lib/load";
import { playerStats, type Match } from "../lib/tournament";

export const metadata = { title: "Player stats" };

// PUBLIC. A player counts as having entered an event when they are on its
// roster, and is credited a win for every played match their section won in
// that event — the rule lives in playerStats(), ported from the old app.
export default async function PlayersPage() {
  const db = await createClient();
  const [events, sections, players, rosters] = await Promise.all([
    loadEvents(),
    loadSections(),
    db
      .from("intersection_players")
      .select("id, name, section_id, profile:profiles(full_name)")
      .order("name"),
    db.from("intersection_rosters").select("event_id, player_id"),
  ]);

  const nameOf = (sectionId: string) =>
    sections.find((s) => s.id === sectionId)?.name ?? "Unknown";

  const matchesByEvent = new Map<string, Match[]>(
    events.map((event) => [event.id, event.matches]),
  );

  const rows = playerStats(
    (players.data ?? []).map((p) => ({
      id: p.id,
      // A linked account shows the name they keep up to date themselves;
      // free-text players show what the HK typed.
      name: p.profile?.full_name?.trim() || p.name,
      sectionId: p.section_id,
    })),
    (rosters.data ?? []).map((r) => ({ eventId: r.event_id, playerId: r.player_id })),
    matchesByEvent,
    nameOf,
  )
    .filter((row) => row.events > 0)
    .sort((a, b) => b.wins - a.wins || b.events - a.events || a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <Link
        href="/intersection"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Intersection
      </Link>
      <h1 className="text-2xl font-semibold">Player stats</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden />
            Most games won
          </CardTitle>
          <CardDescription>
            Every player on an event roster, and the games their section won while they were
            in the squad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No rosters entered yet"
              description="Stats appear once the HK records who played in an event."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs">
                  <th className="pb-2 text-left font-normal">Player</th>
                  <th className="pb-2 text-right font-normal">Events</th>
                  <th className="pb-2 text-right font-normal">Wins</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.playerId}>
                    <td className="py-2">
                      <span className="block font-medium">{row.name}</span>
                      <span className="text-muted-foreground text-xs">{row.sectionName}</span>
                    </td>
                    <td className="text-right tabular-nums">{row.events}</td>
                    <td className="text-right font-medium tabular-nums">{row.wins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
