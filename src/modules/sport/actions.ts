"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { removeModuleEvent, upsertModuleEvent } from "@/core/calendar";
import { createClient } from "@/core/db/server";
import { notify } from "@/core/notifications";
import { requireProfile, requireRole } from "@/core/permissions";
import { formatDateTime, fromLocalInput } from "@/core/ui/format";
import {
  fixtureChange,
  fixtureTitle,
  practiceChanged,
  resultSummary,
  resultTitle,
} from "./lib/sport";

// Sport writes. Who may do what is decided by RLS (migration 0400): admins
// anywhere, a rep only on the sport whose rep_id is them. The checks here
// fail fast and produce a readable message; they are not the gate.

const MODULE = "sport";

async function loadSport(sportId: string) {
  const db = await createClient();
  const { data } = await db
    .from("sports")
    .select("id, name, practice_info, venue, coach, description, rep_id")
    .eq("id", sportId)
    .single();
  return data;
}

const detailsInput = z.object({
  sportId: z.uuid(),
  practiceInfo: z.string().trim().max(200),
  venue: z.string().trim().max(200),
  coach: z.string().trim().max(120),
  description: z.string().trim().max(4000),
});

/**
 * The rep's own page-edit. Players get exactly ONE notification, and only
 * when the practice time or the venue actually moved — nobody needs a push
 * because a typo in the description got fixed.
 */
export async function updateSportDetails(formData: FormData) {
  await requireProfile();
  const parsed = detailsInput.safeParse({
    sportId: formData.get("sportId"),
    practiceInfo: formData.get("practiceInfo") ?? "",
    venue: formData.get("venue") ?? "",
    coach: formData.get("coach") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const input = parsed.data;

  const before = await loadSport(input.sportId);
  if (!before) return { ok: false as const, error: "That sport is gone" };

  const db = await createClient();
  const { data, error } = await db
    .from("sports")
    .update({
      practice_info: input.practiceInfo,
      venue: input.venue,
      coach: input.coach,
      description: input.description,
    })
    .eq("id", input.sportId)
    .select("id");
  if (error) return { ok: false as const, error: "Could not save the changes" };
  // RLS returns zero rows rather than an error when the policy says no.
  if (!data || data.length === 0) {
    return { ok: false as const, error: "Only this sport's rep or an admin can edit it" };
  }

  if (
    practiceChanged(
      { practiceInfo: before.practice_info, venue: before.venue },
      { practiceInfo: input.practiceInfo, venue: input.venue },
    )
  ) {
    await notify({
      category: "sport",
      title: `${before.name}: practice details changed`,
      body: [input.practiceInfo, input.venue].filter(Boolean).join(" · "),
      url: `/sport/${input.sportId}`,
      sourceModule: MODULE,
      sourceRef: input.sportId,
      audience: { kind: "sport", sportId: input.sportId },
    });
  }

  revalidatePath(`/sport/${input.sportId}`);
  revalidatePath("/sport");
  return { ok: true as const };
}

const fixtureInput = z.object({
  id: z.uuid().optional(),
  sportId: z.uuid(),
  opponent: z.string().trim().max(120),
  location: z.string().trim().max(200),
  startsAt: z.string().min(1, "When does it start?"),
  notes: z.string().trim().max(500),
});

/**
 * Create or update a fixture. The calendar entry is a mirror keyed on
 * (source_module, source_ref), so writing the same fixture twice updates the
 * event in place instead of duplicating it.
 */
export async function saveFixture(formData: FormData) {
  await requireProfile();
  const id = String(formData.get("id") ?? "");
  const parsed = fixtureInput.safeParse({
    id: id === "" ? undefined : id,
    sportId: formData.get("sportId"),
    opponent: formData.get("opponent") ?? "",
    location: formData.get("location") ?? "",
    startsAt: formData.get("startsAt"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const input = parsed.data;

  const sport = await loadSport(input.sportId);
  if (!sport) return { ok: false as const, error: "That sport is gone" };

  const db = await createClient();
  const startsAt = fromLocalInput(input.startsAt);
  const row = {
    sport_id: input.sportId,
    opponent: input.opponent,
    location: input.location,
    starts_at: startsAt.toISOString(),
    notes: input.notes,
  };

  let fixtureId = input.id;
  let before: { startsAt: string; location: string } | null = null;

  if (fixtureId) {
    const { data: existing } = await db
      .from("sport_fixtures")
      .select("starts_at, location")
      .eq("id", fixtureId)
      .single();
    before = existing ? { startsAt: existing.starts_at, location: existing.location } : null;
    const { data, error } = await db
      .from("sport_fixtures")
      .update(row)
      .eq("id", fixtureId)
      .select("id");
    if (error) return { ok: false as const, error: "Could not save the fixture" };
    if (!data || data.length === 0) {
      return { ok: false as const, error: "Only this sport's rep or an admin can post fixtures" };
    }
  } else {
    const { data, error } = await db.from("sport_fixtures").insert(row).select("id").single();
    if (error || !data) {
      return { ok: false as const, error: "Only this sport's rep or an admin can post fixtures" };
    }
    fixtureId = data.id;
  }

  const title = fixtureTitle(sport.name, input.opponent);
  await upsertModuleEvent({
    sourceModule: MODULE,
    sourceRef: fixtureId,
    title,
    description: input.notes,
    category: "sport",
    location: input.location,
    startsAt,
  });

  const change = fixtureChange(before, { startsAt: row.starts_at, location: row.location });
  if (change) {
    await notify({
      category: "sport",
      title: change === "new" ? `New fixture: ${title}` : `Moved: ${title}`,
      body: `${formatDateTime(startsAt)}${input.location ? ` · ${input.location}` : ""}`,
      url: `/sport/${input.sportId}`,
      sourceModule: MODULE,
      sourceRef: fixtureId,
      audience: { kind: "sport", sportId: input.sportId },
    });
  }

  revalidatePath(`/sport/${input.sportId}`);
  revalidatePath("/sport");
  // The fixture is now on the shared calendar too, so the calendar tab is
  // stale until it is told. Easy to forget, because the write above went to a
  // table this module never reads.
  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true as const };
}

export async function deleteFixture(fixtureId: string, sportId: string) {
  await requireProfile();
  const parsed = z.object({ fixtureId: z.uuid(), sportId: z.uuid() }).safeParse({ fixtureId, sportId });
  if (!parsed.success) return { ok: false as const, error: "Unknown fixture" };

  const db = await createClient();
  const { data, error } = await db
    .from("sport_fixtures")
    .delete()
    .eq("id", parsed.data.fixtureId)
    .select("id");
  if (error) return { ok: false as const, error: "Could not delete the fixture" };
  if (!data || data.length === 0) {
    return { ok: false as const, error: "Only this sport's rep or an admin can do that" };
  }

  // Deleting the source removes its calendar entry.
  await removeModuleEvent(MODULE, parsed.data.fixtureId);

  revalidatePath(`/sport/${parsed.data.sportId}`);
  revalidatePath("/sport");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true as const };
}

const scoreInput = z.object({
  fixtureId: z.uuid(),
  score: z.string().trim().min(1, "What was the score?").max(60),
});

/**
 * Enter the score for a fixture that has been played. That IS posting the
 * result — there is no separate "post a result" form any more.
 *
 * A result was two jobs before: a fixture, then a result typed out again from
 * scratch, with the opponent and the date entered twice and nothing linking
 * the two. Now the fixture is the record, the score is the one thing anybody
 * types, and the summary and the date come from the fixture itself. The
 * fixture row stays exactly where it is; having a result is what makes it
 * done, which is also what makes deleting the result a clean undo.
 *
 * Three things still happen on the way out: the result row, a short system
 * announcement on the feed so the whole res sees it, and one notification to
 * the people who play that sport. The announcement is written as the rep,
 * under the rep's own session — the narrow insert policy from migration 0401
 * is what allows it. If that insert is refused the result still stands; the
 * rep is told the feed post did not happen rather than losing their work.
 */
export async function recordFixtureResult(fixtureId: string, score: string) {
  const profile = await requireProfile();
  const parsed = scoreInput.safeParse({ fixtureId, score });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const input = parsed.data;

  const db = await createClient();
  const { data: fixture } = await db
    .from("sport_fixtures")
    .select("id, sport_id, opponent, starts_at")
    .eq("id", input.fixtureId)
    .maybeSingle();
  if (!fixture) return { ok: false as const, error: "That fixture is gone" };

  const sport = await loadSport(fixture.sport_id);
  if (!sport) return { ok: false as const, error: "That sport is gone" };

  // Entering a score twice for one fixture would post the res two
  // announcements about the same game.
  const { data: already } = await db
    .from("sport_results")
    .select("id")
    .eq("fixture_id", input.fixtureId)
    .maybeSingle();
  if (already) {
    return { ok: false as const, error: "That fixture already has a score. Delete it to redo it." };
  }

  const summary = resultSummary(fixture.opponent);
  const { data: result, error } = await db
    .from("sport_results")
    .insert({
      sport_id: fixture.sport_id,
      fixture_id: fixture.id,
      summary,
      score: input.score,
      // The day it was played, not the day it was captured — a rep entering
      // Saturday's score on Monday should not see it dated Monday.
      played_at: fixture.starts_at,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !result) {
    return { ok: false as const, error: "Only this sport's rep or an admin can post results" };
  }

  const headline = resultTitle(sport.name, summary, input.score);
  const { error: announcementError } = await db.from("announcements").insert({
    title: headline,
    body: "",
    author_id: profile.id,
    is_system: true,
    status: "published",
    published_at: new Date().toISOString(),
  });

  // Behind the response: the fan-out is a row per person and then a push per
  // device, and the rep is standing next to a field with a phone.
  after(async () => {
    await notify({
      category: "sport",
      title: headline,
      url: `/sport/${fixture.sport_id}`,
      sourceModule: MODULE,
      sourceRef: result.id,
      audience: { kind: "sport", sportId: fixture.sport_id },
    });
  });

  revalidatePath(`/sport/${fixture.sport_id}`);
  revalidatePath("/sport");
  revalidatePath("/");
  if (announcementError) {
    return {
      ok: false as const,
      error: "The result is saved, but it could not be posted to the feed. Tell an admin.",
    };
  }
  return { ok: true as const };
}

export async function deleteResult(resultId: string, sportId: string) {
  await requireProfile();
  const parsed = z.object({ resultId: z.uuid(), sportId: z.uuid() }).safeParse({ resultId, sportId });
  if (!parsed.success) return { ok: false as const, error: "Unknown result" };

  const db = await createClient();
  const { data, error } = await db
    .from("sport_results")
    .delete()
    .eq("id", parsed.data.resultId)
    .select("id");
  if (error) return { ok: false as const, error: "Could not delete the result" };
  if (!data || data.length === 0) {
    return { ok: false as const, error: "Only this sport's rep or an admin can do that" };
  }

  revalidatePath(`/sport/${parsed.data.sportId}`);
  revalidatePath("/sport");
  return { ok: true as const };
}

/**
 * "I'm going." Own row only, and pressing it again undoes it.
 *
 * The row lives in sport_signups. It counts people interested in the sport,
 * not attendance at any particular fixture — tapping the count on the sport's
 * page lists exactly these names.
 */
export async function toggleGoing(sportId: string, going: boolean) {
  const profile = await requireProfile();
  const parsed = z.uuid().safeParse(sportId);
  if (!parsed.success) return { ok: false as const, error: "Unknown sport" };

  const db = await createClient();
  if (going) {
    const { error } = await db
      .from("sport_signups")
      .delete()
      .eq("sport_id", parsed.data)
      .eq("profile_id", profile.id);
    if (error) return { ok: false as const, error: "Could not take you off the list" };
  } else {
    const { error } = await db
      .from("sport_signups")
      .upsert(
        { sport_id: parsed.data, profile_id: profile.id },
        { onConflict: "sport_id,profile_id", ignoreDuplicates: true },
      );
    if (error) return { ok: false as const, error: "Could not add you to the list" };
  }

  revalidatePath(`/sport/${parsed.data}`);
  return { ok: true as const };
}

// --- admin: the catalogue itself --------------------------------------------

const newSportInput = z.object({
  name: z.string().trim().min(2, "Give the sport a name").max(80),
});

export async function createSport(formData: FormData) {
  await requireRole("admin");
  const parsed = newSportInput.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const db = await createClient();
  const { error } = await db.from("sports").insert({ name: parsed.data.name });
  if (error) {
    return {
      ok: false as const,
      error: error.code === "23505" ? "There is already a sport with that name" : "Could not add it",
    };
  }

  revalidatePath("/sport");
  revalidatePath("/sport/admin");
  return { ok: true as const };
}

/**
 * Remove a sport from the catalogue, admin only (`sports_admin_delete`).
 *
 * The database cascades the fixtures, results, sign-ups and everyone's
 * "sports I play" rows. What it cannot reach is the shared calendar: those
 * events are mirrors keyed on (source_module, source_ref), not foreign keys,
 * so every fixture's entry is removed by hand FIRST — after the sport is gone
 * the fixture ids are unknowable and the calendar would keep advertising games
 * for a sport that no longer exists.
 */
export async function deleteSport(sportId: string) {
  await requireRole("admin");
  const parsed = z.uuid().safeParse(sportId);
  if (!parsed.success) return { ok: false as const, error: "Unknown sport" };

  const db = await createClient();
  const { data: fixtures } = await db
    .from("sport_fixtures")
    .select("id")
    .eq("sport_id", parsed.data);
  for (const fixture of fixtures ?? []) {
    await removeModuleEvent(MODULE, fixture.id);
  }

  const { data, error } = await db
    .from("sports")
    .delete()
    .eq("id", parsed.data)
    .select("id");
  if (error) return { ok: false as const, error: "Could not delete that sport" };
  // RLS answers a refused delete with zero rows, not an error.
  if (!data || data.length === 0) {
    return { ok: false as const, error: "Only the HK can delete a sport" };
  }

  revalidatePath("/sport");
  revalidatePath("/sport/admin");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true as const };
}

const repInput = z.object({
  sportId: z.uuid(),
  name: z.string().trim().max(120),
  phone: z.string().trim().max(40),
  // Optional, because the HK often knows the name and number before the
  // address. Without it the card is contact details and nothing more.
  email: z.union([z.literal(""), z.string().trim().email("That email does not look right")]),
});

/**
 * Appoint a sport's rep by typing their details.
 *
 * Admin-only twice over: the check here and the app_guard_sport_rep trigger,
 * which rejects a rep_id change from any signed-in non-admin.
 *
 * The email is what grants the permission, but never directly — it is matched
 * against the address Supabase verified and turned into rep_id, which is the
 * only thing app_is_rep_of() looks at. Matching here covers a rep who already
 * has an account; the app_handle_new_user trigger (migration 0403) covers one
 * who signs up later. Between them there is no order the HK can get wrong.
 */
export async function saveRep(formData: FormData) {
  await requireRole("admin");
  const parsed = repInput.safeParse({
    sportId: formData.get("sportId"),
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const input = parsed.data;

  const db = await createClient();

  // Does this address already have an account? Emails are stored as the user
  // typed them, so match case-insensitively.
  let repId: string | null = null;
  if (input.email !== "") {
    const { data: person } = await db
      .from("profiles")
      .select("id, role")
      .ilike("email", input.email)
      .maybeSingle();
    if (person) {
      repId = person.id;
      // A rep needs sport_rep for the Admin tab. Only lifted from 'student':
      // an admin who happens to run a sport stays an admin.
      if (person.role === "student") {
        await db.from("profiles").update({ role: "sport_rep" }).eq("id", person.id);
      }
    }
  }

  const { data, error } = await db
    .from("sports")
    .update({
      rep_name: input.name,
      rep_phone: input.phone,
      rep_email: input.email,
      rep_id: repId,
    })
    .eq("id", input.sportId)
    .select("id");
  if (error) return { ok: false as const, error: "Could not save the rep" };
  if (!data || data.length === 0) return { ok: false as const, error: "Only an admin can do that" };

  revalidatePath("/sport");
  revalidatePath(`/sport/${input.sportId}`);
  revalidatePath("/sport/admin");
  return {
    ok: true as const,
    // The difference matters to the admin: "saved, and they can edit it now"
    // versus "saved, and they get access the moment they sign up".
    linked: repId !== null,
  };
}
