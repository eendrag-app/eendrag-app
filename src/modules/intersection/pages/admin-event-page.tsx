import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/core/permissions";
import { toLocalInput } from "@/core/ui/format";
import { DeleteEventButton } from "../components/delete-event-button";
import { DrawAdmin } from "../components/draw-admin";
import { EventForm } from "../components/event-form";
import { MatchAdmin, type AdminMatch, type SectionOption } from "../components/match-admin";
import { TieBreakAdmin, type TiedGroup } from "../components/tie-break-admin";
import { sideLabel, stageLabel } from "../lib/copy";
import { canClearResult, canEditGroups, canEditTeams, canRegenerateDraw } from "../lib/guards";
import { loadEvent, loadSections } from "../lib/load";
import { needsTieBreak } from "../lib/tournament";

export const metadata = { title: "Run an event" };

// Running one event: draw it, move teams while you still can, set times,
// enter results, pick the roster.
//
// Every guard is evaluated here, on the server, from the whole match list —
// the client components only render what they are told. That keeps the old
// app's rules in one testable place (lib/guards.ts) instead of scattered
// through the UI.
export default async function AdminEventPage({ params }: PageProps<"/intersection/admin/[id]">) {
  const { id } = await params;
  await requireRole("admin");

  const [event, sections] = await Promise.all([loadEvent(id), loadSections()]);
  if (!event) notFound();


  const nameOf = (sectionId: string) =>
    sections.find((s) => s.id === sectionId)?.name ?? "Unknown";

  const groupsGuard = canEditGroups(event.matches);
  const redrawGuard = canRegenerateDraw(event.matches);

  const adminMatches: AdminMatch[] = event.matches.map((match) => {
    const groupName = event.groups.find((g) => g.id === match.groupId)?.name ?? null;
    const clearGuard = canClearResult(match, event.matches);
    const teamsGuard = canEditTeams(match);
    return {
      id: match.id,
      label: stageLabel(match, groupName),
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      teamALabel: sideLabel(match, 0, nameOf),
      teamBLabel: sideLabel(match, 1, nameOf),
      winnerId: match.winnerId,
      note: match.note ?? "",
      scheduledInput: match.scheduledAt ? toLocalInput(match.scheduledAt) : "",
      played: match.played,
      manual: match.manual,
      canEditTeams: teamsGuard.ok,
      clearBlockedReason: clearGuard.ok ? null : clearGuard.reason,
    };
  });

  const sectionOptions: SectionOption[] = sections;

  // Groups that ended in a three-way tie. Nothing appears unless one actually
  // happened — most events never see this card at all.
  const tiedGroups: TiedGroup[] = event.groups
    .filter((group) => needsTieBreak(group, event.matches))
    .map((group) => ({
      id: group.id,
      name: group.name,
      teams: group.sectionIds.map((sectionId) => ({ id: sectionId, name: nameOf(sectionId) })),
      firstSectionId: group.firstSectionId ?? null,
      secondSectionId: group.secondSectionId ?? null,
    }));

  return (
    <div className="space-y-4">
      <Link
        href="/intersection/admin"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Intersection admin
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <Badge variant="outline">
            {event.status === "completed"
              ? "Finished"
              : event.status === "in_progress"
                ? "In progress"
                : "Upcoming"}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="lg"
          className="h-11"
          nativeButton={false}
          render={<Link href={`/intersection/events/${event.id}`} />}
        >
          <ExternalLink aria-hidden />
          Public page
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>The draw</CardTitle>
          <CardDescription>
            Four groups of three, then QF, semis and the final — A1 plays B2, C1 plays D2,
            B1 plays A2, D1 plays C2. That pattern is res tradition; the app does not let
            anyone change it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DrawAdmin
            eventId={event.id}
            groups={event.groups.map((g) => ({
              id: g.id,
              name: g.name,
              sectionIds: g.sectionIds,
            }))}
            sections={sectionOptions}
            canRegenerate={redrawGuard.ok}
            regenerateBlockedReason={redrawGuard.ok ? null : redrawGuard.reason}
            canEditGroups={groupsGuard.ok}
            editBlockedReason={groupsGuard.ok ? null : groupsGuard.reason}
          />
        </CardContent>
      </Card>

      {tiedGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Who goes through</CardTitle>
            <CardDescription>
              A group of three with no draws either has a clear order or is completely
              level. This one is level, and the app will not guess.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TieBreakAdmin eventId={event.id} groups={tiedGroups} />
          </CardContent>
        </Card>
      )}

      {adminMatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fixtures and results</CardTitle>
            <CardDescription>
              Picking a winner saves immediately, fills in whoever that sends through to the
              next round, and tells both sections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MatchAdmin matches={adminMatches} sections={sectionOptions} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <EventForm
            values={{
              id: event.id,
              name: event.name,
              startDate: event.startDate ?? "",
              rules: event.rules,
            }}
          />
          <div className="border-t pt-4">
            <DeleteEventButton eventId={event.id} eventName={event.name} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
