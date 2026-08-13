import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProfile } from "@/core/permissions";
import { formatLongDate } from "@/core/ui/format";
import { cn } from "@/lib/utils";
import { MatchRow, MatchTime } from "../components/match-row";
import { stageLabel } from "../lib/copy";
import { loadEvent, loadSections } from "../lib/load";
import { needsTieBreak, qualifiers, standings, type Stage } from "../lib/tournament";

export const metadata = { title: "Intersection" };

const STAGE_HEADINGS: Record<Stage, string> = {
  group: "Group games",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  final: "Final",
};

// PUBLIC — this is the page that gets pasted into WhatsApp.
export default async function EventPage({ params }: PageProps<"/intersection/events/[id]">) {
  const { id } = await params;
  // Signed out (which this page must work for) simply means no highlight.
  const [event, sections, profile] = await Promise.all([
    loadEvent(id),
    loadSections(),
    getProfile(),
  ]);
  if (!event) notFound();
  const mySectionId = profile?.section_id ?? null;

  const nameOf = (sectionId: string) =>
    sections.find((s) => s.id === sectionId)?.name ?? "Unknown";

  const stages: Stage[] = ["group", "qf", "sf", "final"];

  return (
    <div className="space-y-4">
      <Link
        href="/intersection"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Intersection
      </Link>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <Badge variant={event.status === "completed" ? "secondary" : "outline"}>
          {event.status === "completed"
            ? "Finished"
            : event.status === "in_progress"
              ? "In progress"
              : "Upcoming"}
        </Badge>
      </div>
      {event.startDate && (
        <p className="text-muted-foreground -mt-2 text-sm">
          {formatLongDate(new Date(`${event.startDate}T12:00:00Z`))}
        </p>
      )}

      {event.groups.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground text-sm">
            The draw has not been made yet. Four groups of three, then quarter-finals,
            semis and a final — check back once the HK has drawn it.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {event.groups.map((group) => {
              const table = standings(group, event.matches, nameOf);
              const tied = needsTieBreak(group, event.matches);
              const through = qualifiers(group, event.matches, nameOf);
              return (
                <Card key={group.id}>
                  <CardHeader>
                    <CardTitle>Group {group.name}</CardTitle>
                    {/* A level group is worth saying out loud: without it the
                        table looks like an ordinary standing and the top row
                        looks like it has qualified, which it has not. */}
                    {tied && (
                      <CardDescription>
                        {through
                          ? `All level on points — the HK sent ${nameOf(through.first)} and ${nameOf(through.second)} through.`
                          : "All level on points. The HK decides who goes through."}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {/* table-fixed with a colgroup, not auto layout: with auto,
                        every group sized its own columns from its own longest
                        section name, so P and W sat in a different place on
                        each of the four cards. The numbers line up across all
                        of them now. */}
                    <table className="w-full table-fixed text-sm">
                      <colgroup>
                        <col />
                        <col className="w-9" />
                        <col className="w-9" />
                        <col className="w-11" />
                      </colgroup>
                      <thead>
                        <tr className="text-muted-foreground text-xs">
                          <th className="pb-1 text-left font-normal">Section</th>
                          <th className="pb-1 text-right font-normal">
                            <abbr title="Played" className="no-underline">P</abbr>
                          </th>
                          <th className="pb-1 text-right font-normal">
                            <abbr title="Won" className="no-underline">W</abbr>
                          </th>
                          <th className="pb-1 text-right font-normal">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.map((row) => (
                          <tr
                            key={row.sectionId}
                            className={cn(row.sectionId === mySectionId && "text-primary font-semibold")}
                          >
                            <td className="truncate py-1 pr-2">{nameOf(row.sectionId)}</td>
                            <td className="text-right tabular-nums">{row.played}</td>
                            <td className="text-right tabular-nums">{row.won}</td>
                            <td className="text-right font-medium tabular-nums">{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {stages.map((stage) => {
            const matches = event.matches.filter((m) => m.stage === stage);
            if (matches.length === 0) return null;
            return (
              <Card key={stage}>
                <CardHeader>
                  <CardTitle>{STAGE_HEADINGS[stage]}</CardTitle>
                </CardHeader>
                <CardContent className="divide-y">
                  {matches.map((match) => {
                    const groupName =
                      event.groups.find((g) => g.id === match.groupId)?.name ?? null;
                    return (
                      <div key={match.id} className="py-1">
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="text-muted-foreground text-xs font-medium">
                            {stageLabel(match, groupName)}
                          </span>
                          <MatchTime scheduledAt={match.scheduledAt} />
                        </div>
                        <MatchRow
                          match={match}
                          note={match.note}
                          nameOf={nameOf}
                          mySectionId={mySectionId}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {event.rules && (
        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{event.rules}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
