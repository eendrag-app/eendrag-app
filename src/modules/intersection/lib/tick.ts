import "server-only";
import { createAdminClient } from "@/core/db/admin";
import { notify } from "@/core/notifications";
import { formatDateTime } from "@/core/ui/format";

// The intersection module's share of the periodic tick: reminding the two
// sections in a fixture that they are playing today.
//
// Kept here rather than in the generic calendar reminder because only this
// module knows that an intersection calendar entry is a match between two
// sections — the mirrored event itself is res-wide.

const REMINDER_WINDOW_HOURS = 24;
const REMINDER_REF = (matchId: string) => `reminder:${matchId}`;

/** Returns how many reminders went out. Idempotent: it checks what was already sent. */
export async function intersectionTick(now: Date): Promise<number> {
  const db = createAdminClient();
  const until = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 3600_000);

  const { data: matches, error } = await db
    .from("intersection_matches")
    .select("id, event_id, scheduled_at, team_a_section_id, team_b_section_id, played")
    .gte("scheduled_at", now.toISOString())
    .lt("scheduled_at", until.toISOString())
    .eq("played", false);
  if (error) throw error;
  const upcoming = (matches ?? []).filter((m) => m.team_a_section_id && m.team_b_section_id);
  if (upcoming.length === 0) return 0;

  const [{ data: already }, { data: events }, { data: sections }] = await Promise.all([
    db
      .from("notifications")
      .select("source_ref")
      .in("source_ref", upcoming.map((m) => REMINDER_REF(m.id))),
    db.from("intersection_events").select("id, name"),
    db.from("sections").select("id, name"),
  ]);
  const done = new Set((already ?? []).map((n) => n.source_ref));
  const eventName = (id: string) => events?.find((e) => e.id === id)?.name ?? "Intersection";
  const sectionName = (id: string) => sections?.find((s) => s.id === id)?.name ?? "another section";

  let sent = 0;
  for (const match of upcoming) {
    if (done.has(REMINDER_REF(match.id))) continue;
    for (const sectionId of [match.team_a_section_id, match.team_b_section_id]) {
      if (!sectionId) continue;
      const opponent =
        sectionId === match.team_a_section_id ? match.team_b_section_id : match.team_a_section_id;
      await notify({
        category: "intersection",
        title: `Today: ${eventName(match.event_id)} vs ${sectionName(opponent ?? "")}`,
        body: match.scheduled_at ? formatDateTime(match.scheduled_at) : "",
        url: `/intersection/events/${match.event_id}`,
        sourceModule: "intersection",
        sourceRef: REMINDER_REF(match.id),
        audience: { kind: "section", sectionId },
        aboutSectionId: sectionId,
      });
    }
    sent += 1;
  }
  return sent;
}
