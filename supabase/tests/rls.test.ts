import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// RLS proof tests. These run against a REAL database (npm run test:rls after
// `supabase start` + `supabase db reset`, or against the linked project) and
// prove the policies in supabase/migrations hold:
//
//   - a student cannot post, edit, or read draft announcements
//   - a rep can edit their own sport only
//   - users cannot read each other's notifications or preferences
//   - nobody can promote themselves to admin
//   - anonymous visitors can view intersection data but never write it
//
// Test users are created through the service role and cleaned up afterwards.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    "RLS tests need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and " +
      "SUPABASE_SERVICE_ROLE_KEY in .env.local. Run `supabase start` and copy the " +
      "values it prints (see README → Running the RLS tests).",
  );
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

const PASSWORD = "rls-test-password";
const createdUserIds: string[] = [];

async function makeUser(label: string): Promise<TestUser> {
  const email = `rls-${label}-${Date.now()}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  createdUserIds.push(data.user.id);

  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, client };
}

async function sectionId(name: string): Promise<string> {
  const { data, error } = await admin.from("sections").select("id").eq("name", name).single();
  if (error) throw error;
  return data.id;
}

async function sportId(name: string): Promise<string> {
  const { data, error } = await admin.from("sports").select("id").eq("name", name).single();
  if (error) throw error;
  return data.id;
}

let student: TestUser; // in Ingang
let otherStudent: TestUser; // in Route 61
let rep: TestUser; // rep of Hockey
let hkAdmin: TestUser;
let hockey: string;
let squash: string;
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

beforeAll(async () => {
  [student, otherStudent, rep, hkAdmin] = await Promise.all([
    makeUser("student"),
    makeUser("other"),
    makeUser("rep"),
    makeUser("admin"),
  ]);
  [hockey, squash] = await Promise.all([sportId("Hockey"), sportId("Squash")]);

  const [ingang, route61] = await Promise.all([
    sectionId("Ingang"),
    sectionId("Route 61"),
  ]);
  await admin.from("profiles").update({ section_id: ingang }).eq("id", student.id);
  await admin.from("profiles").update({ section_id: route61 }).eq("id", otherStudent.id);
  await admin
    .from("profiles")
    .update({ role: "sport_rep", section_id: ingang })
    .eq("id", rep.id);
  await admin.from("profiles").update({ role: "admin" }).eq("id", hkAdmin.id);
  await admin.from("sports").update({ rep_id: rep.id }).eq("id", hockey);
});

afterAll(async () => {
  await admin.from("sports").update({ rep_id: null }).eq("id", hockey);
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("announcements", () => {
  it("a student cannot post an announcement", async () => {
    const { error } = await student.client
      .from("announcements")
      .insert({ title: "Party at my place", status: "published", published_at: new Date().toISOString() });
    expect(error).not.toBeNull();
  });

  it("a student cannot edit an announcement", async () => {
    const { data: existing } = await admin
      .from("announcements")
      .select("id")
      .eq("status", "published")
      .limit(1)
      .single();
    const { data } = await student.client
      .from("announcements")
      .update({ title: "hacked" })
      .eq("id", existing!.id)
      .select();
    expect(data).toEqual([]); // RLS: zero rows touched
  });

  it("a student cannot see drafts or scheduled posts", async () => {
    const { data } = await student.client
      .from("announcements")
      .select("id, status")
      .neq("status", "published");
    expect(data).toEqual([]);
  });

  it("an admin can post an announcement", async () => {
    const { error, data } = await hkAdmin.client
      .from("announcements")
      .insert({
        title: "RLS test announcement",
        status: "published",
        published_at: new Date().toISOString(),
      })
      .select()
      .single();
    expect(error).toBeNull();
    await admin.from("announcements").delete().eq("id", data!.id);
  });

  it("a student only sees section posts aimed at their own section", async () => {
    // Seeded: a published post targeted at Katstraat. Neither test student is
    // in Katstraat, so neither may see it.
    const { data } = await student.client
      .from("announcements")
      .select("id, target_section_id")
      .not("target_section_id", "is", null);
    expect(data).toEqual([]);
  });
});

describe("announcement reads (privacy: counts, never identities)", () => {
  it("a user cannot record a read on someone else's behalf", async () => {
    const { data: ann } = await admin
      .from("announcements")
      .select("id")
      .eq("status", "published")
      .is("target_section_id", null)
      .limit(1)
      .single();
    const { error } = await student.client
      .from("announcement_reads")
      .insert({ announcement_id: ann!.id, profile_id: otherStudent.id });
    expect(error).not.toBeNull();
  });

  it("even an admin cannot list who read an announcement", async () => {
    const { data: ann } = await admin
      .from("announcements")
      .select("id")
      .eq("status", "published")
      .is("target_section_id", null)
      .limit(1)
      .single();
    await student.client
      .from("announcement_reads")
      .insert({ announcement_id: ann!.id, profile_id: student.id });

    const { data } = await hkAdmin.client
      .from("announcement_reads")
      .select("profile_id")
      .eq("announcement_id", ann!.id);
    // The admin's own reads are the most they can ever see.
    expect((data ?? []).filter((r) => r.profile_id !== hkAdmin.id)).toEqual([]);

    // Counts come through the dedicated function instead.
    const { data: counts, error } = await hkAdmin.client.rpc("announcement_read_counts", {
      announcement_ids: [ann!.id],
    });
    expect(error).toBeNull();
    expect(counts![0].read_count).toBeGreaterThanOrEqual(1);
  });
});

describe("sports and reps", () => {
  it("the hockey rep can edit hockey", async () => {
    const { data, error } = await rep.client
      .from("sports")
      .update({ venue: "Updated by rep" })
      .eq("id", hockey)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("the hockey rep cannot edit squash", async () => {
    const { data } = await rep.client
      .from("sports")
      .update({ venue: "Should not land" })
      .eq("id", squash)
      .select();
    expect(data).toEqual([]);
  });

  it("the hockey rep cannot post a squash result", async () => {
    const { error } = await rep.client
      .from("sport_results")
      .insert({ sport_id: squash, summary: "Not my sport" });
    expect(error).not.toBeNull();
  });

  it("a student cannot edit any sport", async () => {
    const { data } = await student.client
      .from("sports")
      .update({ venue: "Student venue" })
      .eq("id", hockey)
      .select();
    expect(data).toEqual([]);
  });

  it("a rep cannot reassign their sport to someone else", async () => {
    const { error } = await rep.client
      .from("sports")
      .update({ rep_id: student.id })
      .eq("id", hockey);
    expect(error).not.toBeNull();
  });

  it("the hockey rep can post a hockey fixture", async () => {
    const { data, error } = await rep.client
      .from("sport_fixtures")
      .insert({ sport_id: hockey, opponent: "RLS test", starts_at: new Date().toISOString() })
      .select("id")
      .single();
    expect(error).toBeNull();
    await admin.from("sport_fixtures").delete().eq("id", data!.id);
  });

  it("the hockey rep cannot post a squash fixture", async () => {
    const { error } = await rep.client
      .from("sport_fixtures")
      .insert({ sport_id: squash, opponent: "Not my sport", starts_at: new Date().toISOString() });
    expect(error).not.toBeNull();
  });

  it("a student cannot post a fixture for any sport", async () => {
    const { error } = await student.client
      .from("sport_fixtures")
      .insert({ sport_id: hockey, opponent: "Nope", starts_at: new Date().toISOString() });
    expect(error).not.toBeNull();
  });
});

// Posting a result auto-writes a one-line announcement as the rep. Migration
// 0401 opens exactly that hole in the announcements policies and no other.
describe("sport reps and the auto-announcement (migration 0401)", () => {
  const systemPost = (authorId: string) => ({
    title: "RLS test: Hockey beat somebody",
    author_id: authorId,
    is_system: true,
    status: "published",
    published_at: new Date().toISOString(),
  });

  it("a rep may post a system announcement authored by themselves", async () => {
    const { data, error } = await rep.client
      .from("announcements")
      .insert(systemPost(rep.id))
      .select("id")
      .single();
    expect(error).toBeNull();
    await admin.from("announcements").delete().eq("id", data!.id);
  });

  it("a rep may not post an ordinary announcement", async () => {
    const { error } = await rep.client.from("announcements").insert({
      ...systemPost(rep.id),
      is_system: false,
    });
    expect(error).not.toBeNull();
  });

  it("a rep may not post an urgent announcement", async () => {
    const { error } = await rep.client.from("announcements").insert({
      ...systemPost(rep.id),
      is_urgent: true,
    });
    expect(error).not.toBeNull();
  });

  it("a rep may not post one in someone else's name", async () => {
    const { error } = await rep.client.from("announcements").insert(systemPost(student.id));
    expect(error).not.toBeNull();
  });

  it("a rep may not target a section with one", async () => {
    const ingang = await sectionId("Ingang");
    const { error } = await rep.client.from("announcements").insert({
      ...systemPost(rep.id),
      target_section_id: ingang,
    });
    expect(error).not.toBeNull();
  });

  it("a student who runs no sport may not post one at all", async () => {
    const { error } = await student.client
      .from("announcements")
      .insert(systemPost(student.id));
    expect(error).not.toBeNull();
  });
});

describe("profiles and roles", () => {
  it("a student cannot promote themselves to admin", async () => {
    const { error } = await student.client
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", student.id);
    expect(error).not.toBeNull();
  });

  it("a student cannot edit someone else's profile", async () => {
    const { data } = await student.client
      .from("profiles")
      .update({ full_name: "Impersonated" })
      .eq("id", otherStudent.id)
      .select();
    expect(data).toEqual([]);
  });

  it("a student can edit their own details", async () => {
    const { error } = await student.client
      .from("profiles")
      .update({ full_name: "RLS Student", room_number: "101" })
      .eq("id", student.id);
    expect(error).toBeNull();
  });
});

describe("notifications and preferences are private", () => {
  it("users cannot read each other's notifications", async () => {
    await admin.from("notifications").insert({
      profile_id: otherStudent.id,
      category: "announcement",
      title: "Private to other student",
      source_module: "home",
    });
    const { data } = await student.client.from("notifications").select("id");
    expect(data).toEqual([]);
  });

  it("users cannot insert notifications directly", async () => {
    const { error } = await student.client.from("notifications").insert({
      profile_id: student.id,
      category: "announcement",
      title: "Forged",
      source_module: "home",
    });
    expect(error).not.toBeNull();
  });

  it("users cannot read each other's preferences", async () => {
    const { data } = await student.client
      .from("notification_preferences")
      .select("profile_id")
      .eq("profile_id", otherStudent.id);
    expect(data).toEqual([]);
  });
});

describe("calendar events", () => {
  it("a student cannot create events", async () => {
    const { error } = await student.client.from("events").insert({
      title: "Fake event",
      category: "res_wide",
      starts_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("an admin can create and delete events", async () => {
    const { data, error } = await hkAdmin.client
      .from("events")
      .insert({
        title: "RLS test event",
        category: "res_wide",
        starts_at: new Date().toISOString(),
      })
      .select()
      .single();
    expect(error).toBeNull();
    const del = await hkAdmin.client.from("events").delete().eq("id", data!.id);
    expect(del.error).toBeNull();
  });
});

describe("intersection is publicly readable, admin writable", () => {
  it("anonymous visitors can read the leaderboard tables", async () => {
    const [events, matches, sections] = await Promise.all([
      anon.from("intersection_events").select("id, name"),
      anon.from("intersection_matches").select("id").limit(1),
      anon.from("sections").select("name"),
    ]);
    expect(events.error).toBeNull();
    expect(events.data!.length).toBeGreaterThan(0);
    expect(matches.error).toBeNull();
    expect(sections.data!.length).toBe(12);
  });

  it("anonymous visitors cannot write results", async () => {
    const { data: match } = await admin
      .from("intersection_matches")
      .select("id, team_a_section_id")
      .eq("played", true)
      .limit(1)
      .single();
    const { data } = await anon
      .from("intersection_matches")
      .update({ winner_section_id: match!.team_a_section_id })
      .eq("id", match!.id)
      .select();
    expect(data).toEqual([]);
  });

  it("a signed-in student cannot edit intersection data either", async () => {
    const { error } = await student.client
      .from("intersection_events")
      .insert({ name: "Fake event" });
    expect(error).not.toBeNull();
  });

  it("a student cannot change leaderboard points", async () => {
    const { data } = await student.client
      .from("intersection_settings")
      .update({ points_champion: 1000 })
      .eq("id", 1)
      .select();
    expect(data).toEqual([]);
  });
});
