"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signOut } from "@/core/auth/provider";
import { createClient } from "@/core/db/server";
import { NOTIFICATION_CATEGORIES } from "@/core/notifications";
import { requireProfile, requireRole, ROLES } from "@/core/permissions";

// Every action: Zod-parse, do the work, return { ok } | { ok: false, error }.
// The role checks below fail fast and politely; RLS is what actually stops a
// student editing someone else's row (see supabase/migrations/0100).

const detailsInput = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(120),
  sectionId: z.uuid("Choose your section"),
  roomNumber: z.string().trim().max(20),
  sportIds: z.array(z.uuid()).max(50),
});

export async function updateDetails(formData: FormData) {
  const profile = await requireProfile();
  const parsed = detailsInput.safeParse({
    fullName: formData.get("fullName"),
    sectionId: formData.get("sectionId"),
    roomNumber: formData.get("roomNumber") ?? "",
    sportIds: formData.getAll("sportIds").map(String),
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const db = await createClient();
  const { error } = await db
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      section_id: parsed.data.sectionId,
      room_number: parsed.data.roomNumber,
    })
    .eq("id", profile.id);
  if (error) return { ok: false as const, error: "Could not save your details" };

  // Sports played are replaced wholesale — the simplest correct behaviour for
  // a checkbox list, and the same thing onboarding does.
  await db.from("user_sports").delete().eq("profile_id", profile.id);
  if (parsed.data.sportIds.length > 0) {
    const { error: sportsError } = await db
      .from("user_sports")
      .insert(parsed.data.sportIds.map((sportId) => ({ profile_id: profile.id, sport_id: sportId })));
    if (sportsError) return { ok: false as const, error: "Could not save your sports" };
  }

  revalidatePath("/profile");
  return { ok: true as const };
}

const preferenceInput = z.object({
  category: z.enum(NOTIFICATION_CATEGORIES),
  enabled: z.boolean(),
});

export async function updateNotificationPreference(category: string, enabled: boolean) {
  const profile = await requireProfile();
  const parsed = preferenceInput.safeParse({ category, enabled });
  if (!parsed.success) return { ok: false as const, error: "Unknown notification setting" };

  const db = await createClient();
  const { error } = await db
    .from("notification_preferences")
    .upsert(
      { profile_id: profile.id, category: parsed.data.category, enabled: parsed.data.enabled },
      { onConflict: "profile_id,category" },
    );
  if (error) return { ok: false as const, error: "Could not save that setting" };

  revalidatePath("/profile");
  return { ok: true as const };
}

const quietHoursInput = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, "Use a time like 23:00"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Use a time like 07:00"),
});

export async function updateQuietHours(formData: FormData) {
  const profile = await requireProfile();
  const parsed = quietHoursInput.safeParse({
    start: formData.get("start"),
    end: formData.get("end"),
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const db = await createClient();
  const { error } = await db
    .from("profiles")
    .update({ quiet_hours_start: parsed.data.start, quiet_hours_end: parsed.data.end })
    .eq("id", profile.id);
  if (error) return { ok: false as const, error: "Could not save your quiet hours" };

  revalidatePath("/profile");
  return { ok: true as const };
}

/** New ICS token: every calendar app subscribed to the old URL stops updating. */
export async function regenerateCalendarToken() {
  const profile = await requireProfile();
  const db = await createClient();
  const { error } = await db
    .from("profiles")
    .update({ calendar_token: crypto.randomUUID() })
    .eq("id", profile.id);
  if (error) return { ok: false as const, error: "Could not make a new link" };

  revalidatePath("/profile");
  return { ok: true as const };
}

const memberInput = z.object({
  profileId: z.uuid(),
  role: z.enum(ROLES),
  isActive: z.boolean(),
});

/** Members admin: role changes and year-end deactivation (docs/ADMIN-GUIDE.md). */
export async function updateMember(profileId: string, role: string, isActive: boolean) {
  const admin = await requireRole("admin");
  const parsed = memberInput.safeParse({ profileId, role, isActive });
  if (!parsed.success) return { ok: false as const, error: "That change is not allowed" };

  if (parsed.data.profileId === admin.id && parsed.data.role !== "admin") {
    // Not a security control (RLS would allow it) — just a foot-gun guard:
    // demoting yourself locks you out of the admin pages instantly.
    return { ok: false as const, error: "Ask another admin to change your own role" };
  }

  const db = await createClient();
  const { error } = await db
    .from("profiles")
    .update({ role: parsed.data.role, is_active: parsed.data.isActive })
    .eq("id", parsed.data.profileId);
  if (error) return { ok: false as const, error: "Could not save that change" };

  revalidatePath("/profile/members");
  return { ok: true as const };
}

export async function signOutAction() {
  await signOut();
  redirect("/login");
}
