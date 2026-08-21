// Import the competition from the OLD intersection app
// (github.com/OliStrauss/eendrag-intersection, Cloudflare Workers + D1) into
// this one, so the two show the same leaderboard while both are live.
//
//   npm run import-intersection -- intersection-backup.json --dry-run
//   npm run import-intersection -- intersection-backup.json
//
// The input file is exactly what the old app's Admin -> Settings -> Download
// backup produces: the whole competition as one JSON document. Getting it
// straight from the database instead, if the admin password is lost:
//
//   npx wrangler d1 execute eendrag --remote --json \
//     --command "SELECT data FROM app_state WHERE id = 1"
//
// and unwrap `.[0].results[0].data`, which is itself JSON.
//
// WHAT IT DOES, in one transaction's worth of intent (see --dry-run first):
//   1. Sets each section's carried-over points on the current season.
//   2. REPLACES every event in the current season with the events in the file.
//      Events in past seasons are never touched.
//
// Step 2 deletes. That is the point — this is a mirror, not a merge, and a
// merge would double every fixture on the second run. Take a backup first
// (Actions -> Nightly backup -> Run workflow) if the target has anything in it
// you cannot rebuild from the old app.
//
// Matching is BY SECTION NAME, because the two apps have no ids in common.
// Every name in the file must exist in `sections` or the import stops before
// writing anything — a silently dropped section is a twelfth of the
// competition scored wrong.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from
// .env.local via node --env-file, see the npm script). Service role because it
// writes competition tables that RLS restricts to signed-in admins, the same
// reason scripts/import-residents.mjs uses it.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — fill in .env.local first (see README).",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");

if (!file) {
  console.error("Usage: npm run import-intersection -- intersection-backup.json [--dry-run]");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// Every failure returns out of main() rather than calling process.exit().
// process.exit() while supabase-js still holds a keep-alive socket trips a
// libuv assertion on Windows, and the script then reports 127 — failure — on a
// run that actually worked.
class Stop extends Error {}
function stop(message) {
  throw new Stop(message);
}

async function main() {

// --- read and check the file ------------------------------------------------

let doc;
try {
  doc = JSON.parse(readFileSync(file, "utf8"));
} catch (error) {
  stop(`Could not read ${file} as JSON: ${error.message}`);
}
for (const key of ["sections", "events", "groups", "matches"]) {
  if (!Array.isArray(doc[key])) {
    stop(`${file} has no "${key}" array — is it an intersection backup?`);
  }
}

// --- the target -------------------------------------------------------------

const { data: season, error: seasonError } = await db
  .from("intersection_seasons")
  .select("id, name")
  .is("archived_at", null)
  .single();
if (seasonError || !season) {
  stop("No current season in intersection_seasons — has migration 0503 been applied to this database?");
}

const { data: sections, error: sectionsError } = await db.from("sections").select("id, name");
if (sectionsError || !sections?.length) stop("Could not read sections.");
const sectionIdByName = new Map(sections.map((s) => [s.name, s.id]));

// Old-app section id -> this app's section uuid, by name. Stop on any name
// that does not match rather than importing eleven twelfths of a competition.
const sectionIdByOldId = new Map();
const unmatched = [];
for (const s of doc.sections) {
  const id = sectionIdByName.get(s.name);
  if (id) sectionIdByOldId.set(s.id, id);
  else unmatched.push(s.name);
}
if (unmatched.length) {
  stop(
    `These sections in the file have no match in this database: ${unmatched.join(", ")}\n` +
      `Known sections: ${[...sectionIdByName.keys()].join(", ")}\n` +
      "Fix the names on one side and re-run. Nothing has been written.",
  );
}

// --- shape the rows ---------------------------------------------------------

/**
 * The old app's `time` is either a date ("2026-08-04") or a local date and
 * time ("2026-08-04T12:30"); this app stores one timestamptz and has no way to
 * say "this day, time still to be arranged".
 *
 * A date on its own therefore becomes NO time rather than midnight: midnight
 * is a time the fixture was never scheduled for, it would read as 00:00 on the
 * fixture list, and it would put a 2am entry on the shared calendar. The
 * fixtures this affects are all already played, where the time is history
 * nobody reads.
 *
 * Times are Africa/Johannesburg, which is UTC+2 all year — the country has no
 * daylight saving, so the offset is a constant and not a lookup.
 */
function toTimestamp(time) {
  if (!time || !time.includes("T")) return null;
  return `${time}:00+02:00`;
}

const STAGE_SLOT = {
  // Old app fixture order: QF 101-104, SF 111-112, final 121. This app numbers
  // the knockout slots from 1 within each stage (tournament.ts generateDraw).
  qf: (order) => order - 100,
  sf: (order) => order - 110,
  final: () => 1,
  group: () => null,
};

const plan = doc.events
  .map((event) => {
    const groups = doc.groups.filter((g) => g.eventId === event.id);
    const matches = doc.matches
      .filter((m) => m.eventId === event.id)
      .sort((a, b) => a.order - b.order);
    return { event, groups, matches };
  })
  // An event with no draw yet is still worth carrying across (it shows as
  // upcoming), but one with no groups AND no matches is an empty shell.
  .filter(({ groups, matches }) => groups.length > 0 || matches.length > 0);

console.log(`Source file:  ${file}`);
console.log(`Target:       ${url}`);
console.log(`Season:       ${season.name}`);
console.log("");
console.log("Carried-over points:");
for (const s of [...doc.sections].sort((a, b) => (b.carry || 0) - (a.carry || 0))) {
  console.log(`  ${String(s.carry ?? 0).padStart(3)}  ${s.name}`);
}
console.log("");
for (const { event, groups, matches } of plan) {
  const played = matches.filter((m) => m.played).length;
  console.log(
    `Event: ${event.name} (${event.date ?? "no date"}, ${event.status ?? "upcoming"}) — ` +
      `${groups.length} groups, ${matches.length} fixtures, ${played} played`,
  );
}
console.log("");

if (dryRun) {
  const { count } = await db
    .from("intersection_events")
    .select("*", { count: "exact", head: true })
    .eq("season_id", season.id);
  console.log(`--dry-run: nothing written. Would REPLACE ${count ?? 0} event(s) in this season.`);
  return;
}

// --- write ------------------------------------------------------------------

// Carried-over points first: they are the leaderboard on their own until an
// event has a champion, so if the run dies after this the table is still right.
const carryRows = doc.sections
  .filter((s) => (s.carry ?? 0) > 0)
  .map((s) => ({
    season_id: season.id,
    section_id: sectionIdByOldId.get(s.id),
    points: s.carry,
  }));
if (carryRows.length) {
  const { error } = await db
    .from("intersection_season_carry")
    .upsert(carryRows, { onConflict: "season_id,section_id" });
  if (error) {
    stop(`Could not write carried-over points: ${error.message}`);
  }
  console.log(`Carried-over points set for ${carryRows.length} sections.`);
}

// Replace this season's events. Groups, group teams and matches all cascade
// from intersection_events, so one delete clears the lot.
const { data: existing } = await db
  .from("intersection_events")
  .select("id, name")
  .eq("season_id", season.id);
if (existing?.length) {
  const { error } = await db.from("intersection_events").delete().eq("season_id", season.id);
  if (error) {
    stop(`Could not clear the season's events: ${error.message}`);
  }
  console.log(`Removed ${existing.length} existing event(s): ${existing.map((e) => e.name).join(", ")}`);
}

for (const { event, groups, matches } of plan) {
  const { data: eventRow, error: eventError } = await db
    .from("intersection_events")
    .insert({
      season_id: season.id,
      name: event.name,
      start_date: event.date || null,
      rules: event.rules || "",
      status: event.status || "upcoming",
    })
    .select("id")
    .single();
  if (eventError || !eventRow) {
    stop(`Could not create "${event.name}": ${eventError?.message}`);
  }

  const groupIdByOldId = new Map();
  if (groups.length) {
    const { data: groupRows, error: groupError } = await db
      .from("intersection_groups")
      .insert(groups.map((g) => ({ event_id: eventRow.id, name: g.name })))
      .select("id, name");
    if (groupError || !groupRows) {
      stop(`Could not create groups for "${event.name}": ${groupError?.message}`);
    }
    const byName = new Map(groupRows.map((g) => [g.name, g.id]));
    for (const g of groups) groupIdByOldId.set(g.id, byName.get(g.name));

    // teamIds are in slot order, and slot order is what the round-robin
    // fixture pattern is built on — do not sort these.
    const teamRows = groups.flatMap((g) =>
      g.teamIds.map((oldSectionId, slot) => ({
        group_id: byName.get(g.name),
        section_id: sectionIdByOldId.get(oldSectionId),
        slot,
      })),
    );
    const { error: teamError } = await db.from("intersection_group_teams").insert(teamRows);
    if (teamError) {
      stop(`Could not fill groups for "${event.name}": ${teamError.message}`);
    }
  }

  if (matches.length) {
    const matchRows = matches.map((m) => ({
      event_id: eventRow.id,
      stage: m.stage,
      group_id: m.groupId ? groupIdByOldId.get(m.groupId) : null,
      slot: STAGE_SLOT[m.stage](m.order),
      source_a: m.sources?.[0] ?? null,
      source_b: m.sources?.[1] ?? null,
      team_a_section_id: m.aId != null ? sectionIdByOldId.get(m.aId) : null,
      team_b_section_id: m.bId != null ? sectionIdByOldId.get(m.bId) : null,
      winner_section_id: m.winnerId != null ? sectionIdByOldId.get(m.winnerId) : null,
      note: m.note ?? null,
      played: !!m.played,
      // The old app lets an admin override a knockout pairing but does not
      // record that it happened, so nothing here can be marked manual. It only
      // matters if the draw is regenerated, which no imported event needs.
      manual: false,
      scheduled_at: toTimestamp(m.time),
      sort_order: m.order,
    }));
    const { error: matchError } = await db.from("intersection_matches").insert(matchRows);
    if (matchError) {
      stop(`Could not create fixtures for "${event.name}": ${matchError.message}`);
    }
  }

  console.log(
    `Imported ${event.name}: ${groups.length} groups, ${matches.length} fixtures, ` +
      `${matches.filter((m) => m.played).length} results.`,
  );
}

// Deliberately no calendar mirroring. This app puts a fixture on the shared
// calendar when an admin gives it a time (src/core/calendar, via the admin
// screen); imported fixtures are either already played or have no time yet, so
// there is nothing a mirror would usefully show. Set a time on a fixture in
// Intersection admin and it appears on the calendar from then on.
console.log("\nDone. Check /intersection.");

}

try {
  await main();
} catch (error) {
  console.error(error instanceof Stop ? error.message : error);
  // Setting the code rather than exiting: the process ends once supabase-js
  // lets its socket go, and the exit status is still a truthful failure.
  process.exitCode = 1;
}
