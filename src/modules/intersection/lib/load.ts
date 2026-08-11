import "server-only";
import { createClient } from "@/core/db/server";
import { byStageAndOrder, type EventStatus, type Group, type Match, type Stage } from "./tournament";

// The bridge between the database and tournament.ts. Everything the tournament
// logic knows about is loaded here, handed over as plain objects, and written
// back afterwards — tournament.ts itself never sees a query.
//
// The whole competition is a handful of events with about twenty matches each,
// so "load everything and assemble in memory" is both the simplest and the
// fastest thing to do. No joins to reason about, no N+1.

export interface EventRow {
  id: string;
  name: string;
  startDate: string | null;
  rules: string;
  status: EventStatus;
}

export interface MatchRow extends Match {
  note: string | null;
  scheduledAt: string | null;
}

export interface LoadedEvent extends EventRow {
  groups: Group[];
  matches: MatchRow[];
}

export interface SectionRow {
  id: string;
  name: string;
}

function toMatch(row: {
  id: string;
  stage: string;
  group_id: string | null;
  slot: number | null;
  source_a: string | null;
  source_b: string | null;
  team_a_section_id: string | null;
  team_b_section_id: string | null;
  winner_section_id: string | null;
  played: boolean;
  manual: boolean;
  sort_order: number;
  note: string | null;
  scheduled_at: string | null;
}): MatchRow {
  return {
    id: row.id,
    stage: row.stage as Stage,
    groupId: row.group_id,
    slot: row.slot,
    sources: row.source_a && row.source_b ? [row.source_a, row.source_b] : null,
    teamAId: row.team_a_section_id,
    teamBId: row.team_b_section_id,
    winnerId: row.winner_section_id,
    played: row.played,
    manual: row.manual,
    sortOrder: row.sort_order,
    note: row.note,
    scheduledAt: row.scheduled_at,
  };
}

/** The twelve sections, in their display order. */
export async function loadSections(): Promise<SectionRow[]> {
  const db = await createClient();
  const { data } = await db.from("sections").select("id, name").order("sort_order");
  return data ?? [];
}

/** Every event with its groups and matches, newest first. */
export async function loadEvents(): Promise<LoadedEvent[]> {
  const db = await createClient();
  const [events, groups, teams, matches] = await Promise.all([
    db
      .from("intersection_events")
      .select("id, name, start_date, rules, status")
      .order("start_date", { ascending: false, nullsFirst: false }),
    db.from("intersection_groups").select("id, event_id, name"),
    db.from("intersection_group_teams").select("group_id, section_id, slot").order("slot"),
    db
      .from("intersection_matches")
      .select(
        "id, event_id, stage, group_id, slot, source_a, source_b, team_a_section_id, team_b_section_id, winner_section_id, played, manual, sort_order, note, scheduled_at",
      ),
  ]);

  const teamsByGroup = new Map<string, string[]>();
  for (const team of teams.data ?? []) {
    const list = teamsByGroup.get(team.group_id) ?? [];
    list[team.slot] = team.section_id;
    teamsByGroup.set(team.group_id, list);
  }

  const groupsByEvent = new Map<string, Group[]>();
  for (const group of groups.data ?? []) {
    const list = groupsByEvent.get(group.event_id) ?? [];
    list.push({ id: group.id, name: group.name, sectionIds: teamsByGroup.get(group.id) ?? [] });
    groupsByEvent.set(group.event_id, list);
  }
  for (const list of groupsByEvent.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  const matchesByEvent = new Map<string, MatchRow[]>();
  for (const row of matches.data ?? []) {
    const list = matchesByEvent.get(row.event_id) ?? [];
    list.push(toMatch(row));
    matchesByEvent.set(row.event_id, list);
  }
  for (const list of matchesByEvent.values()) list.sort(byStageAndOrder);

  return (events.data ?? []).map((event) => ({
    id: event.id,
    name: event.name,
    startDate: event.start_date,
    rules: event.rules,
    status: event.status as EventStatus,
    groups: groupsByEvent.get(event.id) ?? [],
    matches: matchesByEvent.get(event.id) ?? [],
  }));
}

export async function loadEvent(eventId: string): Promise<LoadedEvent | null> {
  const all = await loadEvents();
  return all.find((event) => event.id === eventId) ?? null;
}

/** The leaderboard points, editable by admins in the intersection settings. */
export async function loadPoints() {
  const db = await createClient();
  const { data } = await db
    .from("intersection_settings")
    .select("points_champion, points_runner_up, points_semis, points_quarters, points_group")
    .eq("id", 1)
    .single();
  return {
    champion: data?.points_champion ?? 15,
    runnerUp: data?.points_runner_up ?? 12,
    semis: data?.points_semis ?? 9,
    quarters: data?.points_quarters ?? 6,
    group: data?.points_group ?? 3,
  };
}
