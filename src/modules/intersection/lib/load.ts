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

export interface SeasonRow {
  id: string;
  name: string;
  startedOn: string;
  archivedAt: string | null;
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

/**
 * Every season, current one first, then most recently archived.
 * The current season is the single row with archived_at null — the database
 * enforces that there is only ever one (0503_intersection_seasons.sql).
 */
export async function loadSeasons(): Promise<SeasonRow[]> {
  const db = await createClient();
  const { data } = await db
    .from("intersection_seasons")
    .select("id, name, started_on, archived_at")
    .order("started_on", { ascending: false });
  const rows = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    startedOn: row.started_on,
    archivedAt: row.archived_at,
  }));
  return rows.sort((a, b) => Number(!!a.archivedAt) - Number(!!b.archivedAt));
}

export async function loadCurrentSeason(): Promise<SeasonRow | null> {
  const seasons = await loadSeasons();
  return seasons.find((s) => !s.archivedAt) ?? null;
}

/**
 * Points each section starts the given season on. Empty for a season that
 * ran from its first event, which is every season after this one.
 */
export async function loadCarry(seasonId: string): Promise<Map<string, number>> {
  const db = await createClient();
  const { data } = await db
    .from("intersection_season_carry")
    .select("section_id, points")
    .eq("season_id", seasonId);
  return new Map((data ?? []).map((row) => [row.section_id, row.points]));
}

/**
 * Every event with its groups and matches, newest first. Scoped to one season
 * when given a season id — which the pages always do, so an archived season's
 * events never leak into the current leaderboard.
 */
export async function loadEvents(seasonId?: string): Promise<LoadedEvent[]> {
  const db = await createClient();
  // Built in two steps rather than a ternary so the .select() string stays one
  // literal — supabase-js infers the row type from it, and a query assembled
  // out of branches types as `unknown`.
  let eventQuery = db
    .from("intersection_events")
    .select("id, name, start_date, rules, status")
    .order("start_date", { ascending: false, nullsFirst: false });
  if (seasonId) eventQuery = eventQuery.eq("season_id", seasonId);

  const [events, groups, teams, matches] = await Promise.all([
    eventQuery,
    db
      .from("intersection_groups")
      .select("id, event_id, name, first_section_id, second_section_id"),
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
    list.push({
      id: group.id,
      name: group.name,
      sectionIds: teamsByGroup.get(group.id) ?? [],
      firstSectionId: group.first_section_id,
      secondSectionId: group.second_section_id,
    });
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
  // Fallbacks match the column defaults in 0504_intersection_points_scheme.sql
  // and the old intersection app's POINTS — 42 points to an event.
  return {
    champion: data?.points_champion ?? 12,
    runnerUp: data?.points_runner_up ?? 8,
    semis: data?.points_semis ?? 5,
    quarters: data?.points_quarters ?? 3,
    group: data?.points_group ?? 0,
  };
}
