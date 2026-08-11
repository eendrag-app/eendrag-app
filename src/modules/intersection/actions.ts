"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { removeModuleEvent, upsertModuleEvent } from "@/core/calendar";
import { createClient } from "@/core/db/server";
import { notify } from "@/core/notifications";
import { requireRole } from "@/core/permissions";
import { formatDateTime, fromLocalInput } from "@/core/ui/format";
import { calendarTitle, positionMove, resultHeadline } from "./lib/copy";
import { canClearResult, canEditGroups, canEditTeams, canRegenerateDraw } from "./lib/guards";
import { loadEvent, loadEvents, loadPoints, loadSections, type LoadedEvent } from "./lib/load";
import { generateDraw, leaderboard, recalc, type LeaderboardRow } from "./lib/tournament";

// Everything that writes to the competition. Admin-only, twice: requireRole
// here and `for all to authenticated using (app_is_admin())` on every
// intersection table (migration 0500).
//
// The rules themselves are never reimplemented here — draw generation,
// standings, knockout progression and points all come from lib/tournament.ts,
// which is a 1:1 port of the old app with tests pinning its behaviour. This
// file loads rows, calls that, and writes the answer back.

const MODULE = "intersection";

function revalidateEvent(eventId: string) {
  revalidatePath("/intersection");
  revalidatePath(`/intersection/events/${eventId}`);
  revalidatePath(`/intersection/admin/${eventId}`);
  revalidatePath("/intersection/players");
  revalidatePath("/");
  // revalidatePath marks those routes stale for the next request; refresh()
  // re-renders the page the admin is looking at right now, so the guards on
  // screen (can this result be cleared? can the draw be redone?) stop
  // answering from before the write.
  refresh();
}

/**
 * Re-derive the bracket after any result change and write back what moved:
 * knockout participants, the event's status, and the calendar entries for
 * matches that have a time (their titles change when the teams become known).
 */
async function recalcAndPersist(eventId: string): Promise<LoadedEvent | null> {
  const [event, sections] = await Promise.all([loadEvent(eventId), loadSections()]);
  if (!event) return null;
  const nameOf = (id: string) => sections.find((s) => s.id === id)?.name ?? "Unknown";

  const before = event.matches.map((m) => ({ ...m }));
  const status = recalc(event.groups, event.matches, nameOf);

  const db = await createClient();
  for (const match of event.matches) {
    const was = before.find((m) => m.id === match.id)!;
    if (was.teamAId !== match.teamAId || was.teamBId !== match.teamBId) {
      await db
        .from("intersection_matches")
        .update({ team_a_section_id: match.teamAId, team_b_section_id: match.teamBId })
        .eq("id", match.id);
    }
  }
  if (status !== event.status) {
    await db.from("intersection_events").update({ status }).eq("id", eventId);
  }

  // Keep the calendar honest: a scheduled match whose teams have just been
  // decided should say so.
  for (const match of event.matches) {
    if (!match.scheduledAt) continue;
    const groupName = event.groups.find((g) => g.id === match.groupId)?.name ?? null;
    await upsertModuleEvent({
      sourceModule: MODULE,
      sourceRef: match.id,
      title: calendarTitle(event.name, match, groupName, nameOf),
      category: "intersection",
      // Intersection games are res-wide interest, not one section's business.
      sectionId: null,
      startsAt: new Date(match.scheduledAt),
    });
  }

  return { ...event, status };
}

async function currentLeaderboard(): Promise<LeaderboardRow[]> {
  const [events, sections, points] = await Promise.all([
    loadEvents(),
    loadSections(),
    loadPoints(),
  ]);
  return leaderboard(
    sections,
    events.filter((e) => e.status === "completed"),
    points,
  );
}

// --- events -----------------------------------------------------------------

const eventInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Give the event a name").max(120),
  startDate: z.string().nullable(),
  rules: z.string().trim().max(4000),
});

export async function saveEvent(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const parsed = eventInput.safeParse({
    id: id === "" ? undefined : id,
    name: formData.get("name"),
    startDate: startDate === "" ? null : startDate,
    rules: formData.get("rules") ?? "",
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const db = await createClient();
  const row = {
    name: parsed.data.name,
    start_date: parsed.data.startDate,
    rules: parsed.data.rules,
  };

  if (parsed.data.id) {
    const { error } = await db.from("intersection_events").update(row).eq("id", parsed.data.id);
    if (error) return { ok: false as const, error: "Could not save the event" };
    revalidateEvent(parsed.data.id);
    return { ok: true as const };
  }

  const { data, error } = await db
    .from("intersection_events")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: "Could not create the event" };
  revalidateEvent(data.id);
  redirect(`/intersection/admin/${data.id}`);
}

export async function deleteEvent(eventId: string) {
  await requireRole("admin");
  const parsed = z.uuid().safeParse(eventId);
  if (!parsed.success) return { ok: false as const, error: "Unknown event" };

  const event = await loadEvent(parsed.data);
  const db = await createClient();
  const { error } = await db.from("intersection_events").delete().eq("id", parsed.data);
  if (error) return { ok: false as const, error: "Could not delete the event" };

  // Groups, matches, rosters cascade in the database; the calendar mirrors do
  // not, so they are cleaned up here.
  for (const match of event?.matches ?? []) {
    await removeModuleEvent(MODULE, match.id);
  }

  revalidateEvent(parsed.data);
  redirect("/intersection/admin");
}

// --- the draw ---------------------------------------------------------------

/**
 * Shuffle the twelve sections into four groups of three and lay out the whole
 * fixture list. The shuffle and the fixture pattern come from
 * generateDraw() — the bracket is res tradition, not a decision this file
 * gets to make.
 */
export async function generateDrawAction(eventId: string) {
  await requireRole("admin");
  const parsed = z.uuid().safeParse(eventId);
  if (!parsed.success) return { ok: false as const, error: "Unknown event" };

  const [event, sections] = await Promise.all([loadEvent(parsed.data), loadSections()]);
  if (!event) return { ok: false as const, error: "Unknown event" };
  if (sections.length !== 12) {
    return { ok: false as const, error: `A draw needs exactly 12 sections, there are ${sections.length}` };
  }
  const guard = canRegenerateDraw(event.matches);
  if (!guard.ok) return { ok: false as const, error: guard.reason };

  const db = await createClient();
  // Clearing the old draw: matches and groups cascade from the event, so they
  // are deleted explicitly here, along with their calendar entries.
  for (const match of event.matches) await removeModuleEvent(MODULE, match.id);
  await db.from("intersection_matches").delete().eq("event_id", parsed.data);
  await db.from("intersection_groups").delete().eq("event_id", parsed.data);

  const draw = generateDraw(sections.map((s) => s.id));

  const { data: groupRows, error: groupError } = await db
    .from("intersection_groups")
    .insert(draw.groups.map((g) => ({ event_id: parsed.data, name: g.name })))
    .select("id, name");
  if (groupError || !groupRows) return { ok: false as const, error: "Could not save the groups" };
  const groupIdByName = new Map(groupRows.map((g) => [g.name, g.id]));

  const teamRows = draw.groups.flatMap((group) =>
    group.sectionIds.map((sectionId, slot) => ({
      group_id: groupIdByName.get(group.name)!,
      section_id: sectionId,
      slot,
    })),
  );
  const { error: teamError } = await db.from("intersection_group_teams").insert(teamRows);
  if (teamError) return { ok: false as const, error: "Could not save the groups" };

  const matchRows = draw.matches.map((match) => {
    const group = match.groupName ? draw.groups.find((g) => g.name === match.groupName) : null;
    return {
      event_id: parsed.data,
      stage: match.stage,
      group_id: match.groupName ? groupIdByName.get(match.groupName)! : null,
      slot: match.slot,
      source_a: match.sources?.[0] ?? null,
      source_b: match.sources?.[1] ?? null,
      team_a_section_id: group && match.teamASlot !== null ? group.sectionIds[match.teamASlot] : null,
      team_b_section_id: group && match.teamBSlot !== null ? group.sectionIds[match.teamBSlot] : null,
      sort_order: match.sortOrder,
    };
  });
  const { error: matchError } = await db.from("intersection_matches").insert(matchRows);
  if (matchError) return { ok: false as const, error: "Could not save the fixtures" };

  await recalcAndPersist(parsed.data);
  revalidateEvent(parsed.data);
  return { ok: true as const };
}

/**
 * Move a section into a group slot before the games start. Whoever is already
 * in that slot swaps with them, so the twelve stay distinct however hard an
 * admin clicks.
 */
export async function swapGroupTeam(eventId: string, groupId: string, slot: number, sectionId: string) {
  await requireRole("admin");
  const parsed = z
    .object({ eventId: z.uuid(), groupId: z.uuid(), slot: z.number().int().min(0).max(2), sectionId: z.uuid() })
    .safeParse({ eventId, groupId, slot, sectionId });
  if (!parsed.success) return { ok: false as const, error: "That move is not allowed" };

  const event = await loadEvent(parsed.data.eventId);
  if (!event) return { ok: false as const, error: "Unknown event" };
  const guard = canEditGroups(event.matches);
  if (!guard.ok) return { ok: false as const, error: guard.reason };

  const target = event.groups.find((g) => g.id === parsed.data.groupId);
  if (!target) return { ok: false as const, error: "Unknown group" };
  const displaced = target.sectionIds[parsed.data.slot];
  if (displaced === parsed.data.sectionId) return { ok: true as const };

  // Remember which slots each group game is between, using the groups as they
  // stand now. After the swap the same slots hold different sections, and the
  // fixtures follow — without this file having to know the round-robin
  // pattern, which is tournament.ts's business.
  const slotPattern = new Map<string, [number, number]>();
  for (const match of event.matches) {
    if (match.stage !== "group" || !match.groupId) continue;
    const group = event.groups.find((g) => g.id === match.groupId);
    if (!group) continue;
    const a = group.sectionIds.indexOf(match.teamAId ?? "");
    const b = group.sectionIds.indexOf(match.teamBId ?? "");
    if (a >= 0 && b >= 0) slotPattern.set(match.id, [a, b]);
  }

  // Where does the incoming section currently sit?
  const source = event.groups.find((g) => g.sectionIds.includes(parsed.data.sectionId));
  const sourceSlot = source?.sectionIds.indexOf(parsed.data.sectionId) ?? -1;

  const db = await createClient();
  // Park the displaced section out of the way first: (group, section) is
  // unique, so a direct swap would collide mid-flight.
  await db
    .from("intersection_group_teams")
    .delete()
    .eq("group_id", parsed.data.groupId)
    .eq("slot", parsed.data.slot);
  if (source && sourceSlot >= 0) {
    await db
      .from("intersection_group_teams")
      .delete()
      .eq("group_id", source.id)
      .eq("slot", sourceSlot);
    await db.from("intersection_group_teams").insert({
      group_id: source.id,
      section_id: displaced,
      slot: sourceSlot,
    });
  }
  const { error } = await db.from("intersection_group_teams").insert({
    group_id: parsed.data.groupId,
    section_id: parsed.data.sectionId,
    slot: parsed.data.slot,
  });
  if (error) return { ok: false as const, error: "Could not move that team" };

  // Re-seed the group games from the slots they were always between.
  const refreshed = await loadEvent(parsed.data.eventId);
  for (const match of refreshed?.matches ?? []) {
    const pattern = slotPattern.get(match.id);
    const group = refreshed?.groups.find((g) => g.id === match.groupId);
    if (!pattern || !group) continue;
    await db
      .from("intersection_matches")
      .update({
        team_a_section_id: group.sectionIds[pattern[0]],
        team_b_section_id: group.sectionIds[pattern[1]],
      })
      .eq("id", match.id);
  }

  await recalcAndPersist(parsed.data.eventId);
  revalidateEvent(parsed.data.eventId);
  return { ok: true as const };
}

// --- results ----------------------------------------------------------------

const resultInput = z.object({
  matchId: z.uuid(),
  winnerSectionId: z.uuid(),
  note: z.string().trim().max(120),
});

export async function setResult(matchId: string, winnerSectionId: string, note: string) {
  await requireRole("admin");
  const parsed = resultInput.safeParse({ matchId, winnerSectionId, note });
  if (!parsed.success) return { ok: false as const, error: "That result is not allowed" };

  const db = await createClient();
  const { data: row } = await db
    .from("intersection_matches")
    .select("id, event_id, team_a_section_id, team_b_section_id")
    .eq("id", parsed.data.matchId)
    .single();
  if (!row) return { ok: false as const, error: "Unknown match" };
  if (![row.team_a_section_id, row.team_b_section_id].includes(parsed.data.winnerSectionId)) {
    return { ok: false as const, error: "The winner has to be one of the two teams" };
  }

  const before = await currentLeaderboard();

  const { error } = await db
    .from("intersection_matches")
    .update({
      winner_section_id: parsed.data.winnerSectionId,
      note: parsed.data.note === "" ? null : parsed.data.note,
      played: true,
    })
    .eq("id", parsed.data.matchId);
  if (error) return { ok: false as const, error: "Could not save the result" };

  const event = await recalcAndPersist(row.event_id);
  const after = await currentLeaderboard();

  const sections = await loadSections();
  const nameOf = (id: string) => sections.find((s) => s.id === id)?.name ?? "Unknown";
  const loserId =
    row.team_a_section_id === parsed.data.winnerSectionId
      ? row.team_b_section_id
      : row.team_a_section_id;

  // One notification per involved section, each "about" that section so
  // section-only mode lets it through.
  for (const sectionId of [parsed.data.winnerSectionId, loserId]) {
    if (!sectionId) continue;
    const move = positionMove(before, after, sectionId);
    await notify({
      category: "intersection",
      title: resultHeadline(
        nameOf(parsed.data.winnerSectionId),
        nameOf(loserId ?? ""),
        event?.name ?? "Intersection",
      ),
      body: [parsed.data.note, move].filter(Boolean).join(" · "),
      url: `/intersection/events/${row.event_id}`,
      sourceModule: MODULE,
      sourceRef: parsed.data.matchId,
      audience: { kind: "section", sectionId },
      aboutSectionId: sectionId,
    });
  }

  revalidateEvent(row.event_id);
  return { ok: true as const };
}

export async function clearResult(matchId: string) {
  await requireRole("admin");
  const parsed = z.uuid().safeParse(matchId);
  if (!parsed.success) return { ok: false as const, error: "Unknown match" };

  const db = await createClient();
  const { data: row } = await db
    .from("intersection_matches")
    .select("id, event_id")
    .eq("id", parsed.data)
    .single();
  if (!row) return { ok: false as const, error: "Unknown match" };

  const event = await loadEvent(row.event_id);
  const match = event?.matches.find((m) => m.id === parsed.data);
  if (!event || !match) return { ok: false as const, error: "Unknown match" };

  const guard = canClearResult(match, event.matches);
  if (!guard.ok) return { ok: false as const, error: guard.reason };

  const { error } = await db
    .from("intersection_matches")
    .update({ winner_section_id: null, note: null, played: false })
    .eq("id", parsed.data);
  if (error) return { ok: false as const, error: "Could not clear the result" };

  // A cleared knockout result un-decides everything downstream, so the teams
  // it fed have to be recomputed too.
  await db
    .from("intersection_matches")
    .update({ team_a_section_id: null, team_b_section_id: null })
    .eq("event_id", row.event_id)
    .neq("stage", "group")
    .eq("played", false)
    .eq("manual", false);

  await recalcAndPersist(row.event_id);
  revalidateEvent(row.event_id);
  return { ok: true as const };
}

/** The old app's "Edit teams": an admin overrides a knockout pairing by hand. */
export async function setMatchTeams(matchId: string, teamAId: string | null, teamBId: string | null) {
  await requireRole("admin");
  const parsed = z
    .object({ matchId: z.uuid(), teamAId: z.uuid().nullable(), teamBId: z.uuid().nullable() })
    .safeParse({
      matchId,
      teamAId: teamAId === "" ? null : teamAId,
      teamBId: teamBId === "" ? null : teamBId,
    });
  if (!parsed.success) return { ok: false as const, error: "That pairing is not allowed" };
  if (parsed.data.teamAId && parsed.data.teamAId === parsed.data.teamBId) {
    return { ok: false as const, error: "A section cannot play itself" };
  }

  const db = await createClient();
  const { data: row } = await db
    .from("intersection_matches")
    .select("id, event_id")
    .eq("id", parsed.data.matchId)
    .single();
  if (!row) return { ok: false as const, error: "Unknown match" };

  const event = await loadEvent(row.event_id);
  const match = event?.matches.find((m) => m.id === parsed.data.matchId);
  if (!match) return { ok: false as const, error: "Unknown match" };
  const guard = canEditTeams(match);
  if (!guard.ok) return { ok: false as const, error: guard.reason };

  const { error } = await db
    .from("intersection_matches")
    .update({
      team_a_section_id: parsed.data.teamAId,
      team_b_section_id: parsed.data.teamBId,
      // `manual` is what stops recalc from putting the bracket's own answer
      // back over the admin's.
      manual: true,
    })
    .eq("id", parsed.data.matchId);
  if (error) return { ok: false as const, error: "Could not save the pairing" };

  await recalcAndPersist(row.event_id);
  revalidateEvent(row.event_id);
  return { ok: true as const };
}

/** Give a match a time (or take it away). A time is what puts it on the calendar. */
export async function setMatchTime(matchId: string, scheduledAt: string) {
  await requireRole("admin");
  const parsed = z.uuid().safeParse(matchId);
  if (!parsed.success) return { ok: false as const, error: "Unknown match" };

  const db = await createClient();
  const { data: row } = await db
    .from("intersection_matches")
    .select("id, event_id, scheduled_at")
    .eq("id", parsed.data)
    .single();
  if (!row) return { ok: false as const, error: "Unknown match" };

  const when = scheduledAt === "" ? null : fromLocalInput(scheduledAt);
  const { error } = await db
    .from("intersection_matches")
    .update({ scheduled_at: when ? when.toISOString() : null })
    .eq("id", parsed.data);
  if (error) return { ok: false as const, error: "Could not save the time" };

  const event = await recalcAndPersist(row.event_id);
  if (!when) {
    await removeModuleEvent(MODULE, parsed.data);
  }

  // Tell the two sections involved — but only when there is a time, the teams
  // are known, and the time actually changed.
  const match = event?.matches.find((m) => m.id === parsed.data);
  const changed = (row.scheduled_at ?? "") !== (when?.toISOString() ?? "");
  if (when && changed && match) {
    const sections = await loadSections();
    const nameOf = (id: string) => sections.find((s) => s.id === id)?.name ?? "Unknown";
    for (const sectionId of [match.teamAId, match.teamBId]) {
      if (!sectionId) continue;
      const other = sectionId === match.teamAId ? match.teamBId : match.teamAId;
      await notify({
        category: "intersection",
        title: `${event?.name}: you play ${other ? nameOf(other) : "the winner of an earlier game"}`,
        body: formatDateTime(when),
        url: `/intersection/events/${row.event_id}`,
        sourceModule: MODULE,
        sourceRef: parsed.data,
        audience: { kind: "section", sectionId },
        aboutSectionId: sectionId,
      });
    }
  }

  revalidateEvent(row.event_id);
  return { ok: true as const };
}

// --- settings, players, rosters ---------------------------------------------

const pointsInput = z.object({
  champion: z.coerce.number().int().min(0).max(999),
  runnerUp: z.coerce.number().int().min(0).max(999),
  semis: z.coerce.number().int().min(0).max(999),
  quarters: z.coerce.number().int().min(0).max(999),
  group: z.coerce.number().int().min(0).max(999),
});

export async function savePoints(formData: FormData) {
  await requireRole("admin");
  const parsed = pointsInput.safeParse({
    champion: formData.get("champion"),
    runnerUp: formData.get("runnerUp"),
    semis: formData.get("semis"),
    quarters: formData.get("quarters"),
    group: formData.get("group"),
  });
  if (!parsed.success) return { ok: false as const, error: "Points have to be whole numbers" };

  const db = await createClient();
  const { error } = await db
    .from("intersection_settings")
    .update({
      points_champion: parsed.data.champion,
      points_runner_up: parsed.data.runnerUp,
      points_semis: parsed.data.semis,
      points_quarters: parsed.data.quarters,
      points_group: parsed.data.group,
    })
    .eq("id", 1);
  if (error) return { ok: false as const, error: "Could not save the points" };

  revalidatePath("/intersection");
  revalidatePath("/intersection/admin");
  return { ok: true as const };
}

const playerInput = z.object({
  name: z.string().trim().min(2, "Enter the player's name").max(120),
  sectionId: z.uuid("Pick a section"),
  profileId: z.uuid().nullable(),
});

export async function createPlayer(formData: FormData) {
  await requireRole("admin");
  const profileId = String(formData.get("profileId") ?? "");
  const parsed = playerInput.safeParse({
    name: formData.get("name"),
    sectionId: formData.get("sectionId"),
    profileId: profileId === "" ? null : profileId,
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const db = await createClient();
  const { error } = await db.from("intersection_players").insert({
    name: parsed.data.name,
    section_id: parsed.data.sectionId,
    profile_id: parsed.data.profileId,
  });
  if (error) return { ok: false as const, error: "Could not add the player" };

  revalidatePath("/intersection/admin");
  revalidatePath("/intersection/players");
  return { ok: true as const };
}

export async function deletePlayer(playerId: string) {
  await requireRole("admin");
  const parsed = z.uuid().safeParse(playerId);
  if (!parsed.success) return { ok: false as const, error: "Unknown player" };

  const db = await createClient();
  const { error } = await db.from("intersection_players").delete().eq("id", parsed.data);
  if (error) return { ok: false as const, error: "Could not remove the player" };

  revalidatePath("/intersection/admin");
  revalidatePath("/intersection/players");
  return { ok: true as const };
}

/** Who is playing in this event — the roster is what player stats count from. */
export async function toggleRoster(eventId: string, playerId: string, on: boolean) {
  await requireRole("admin");
  const parsed = z.object({ eventId: z.uuid(), playerId: z.uuid() }).safeParse({ eventId, playerId });
  if (!parsed.success) return { ok: false as const, error: "Unknown player" };

  const db = await createClient();
  if (on) {
    const { error } = await db
      .from("intersection_rosters")
      .upsert(
        { event_id: parsed.data.eventId, player_id: parsed.data.playerId },
        { onConflict: "event_id,player_id", ignoreDuplicates: true },
      );
    if (error) return { ok: false as const, error: "Could not add them to the roster" };
  } else {
    const { error } = await db
      .from("intersection_rosters")
      .delete()
      .eq("event_id", parsed.data.eventId)
      .eq("player_id", parsed.data.playerId);
    if (error) return { ok: false as const, error: "Could not take them off the roster" };
  }

  revalidateEvent(parsed.data.eventId);
  return { ok: true as const };
}
