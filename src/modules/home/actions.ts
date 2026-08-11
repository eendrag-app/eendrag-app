"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/core/db/server";
import { notify } from "@/core/notifications";
import { requireProfile, requireRole } from "@/core/permissions";
import { formatDateTime, fromLocalInput } from "@/core/ui/format";
import { notifyAnnouncementPublished } from "./lib/publish";

// Announcement writing. requireRole("admin") is the polite door; the real gate
// is the RLS policy set on announcements (migration 0300) — a student POSTing
// straight at these actions gets nothing.

const saveInput = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().min(1, "Give it a title").max(200),
    body: z.string().trim().max(20_000),
    isUrgent: z.boolean(),
    targetSectionId: z.uuid().nullable(),
    imagePath: z.string().max(300).nullable(),
    pdfPath: z.string().max(300).nullable(),
    intent: z.enum(["draft", "schedule", "publish"]),
    scheduledFor: z.string().nullable(),
  })
  .refine((v) => v.intent !== "schedule" || (v.scheduledFor ?? "") !== "", {
    message: "Pick a date and time to schedule it",
    path: ["scheduledFor"],
  });

function readSaveForm(formData: FormData) {
  const section = String(formData.get("targetSectionId") ?? "");
  const image = String(formData.get("imagePath") ?? "");
  const pdf = String(formData.get("pdfPath") ?? "");
  const scheduled = String(formData.get("scheduledFor") ?? "");
  const id = String(formData.get("id") ?? "");
  return {
    id: id === "" ? undefined : id,
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    isUrgent: formData.get("isUrgent") === "on" || formData.get("isUrgent") === "true",
    // "" is the "whole res" option in the select — not a missing value.
    targetSectionId: section === "" ? null : section,
    imagePath: image === "" ? null : image,
    pdfPath: pdf === "" ? null : pdf,
    intent: formData.get("intent"),
    scheduledFor: scheduled === "" ? null : scheduled,
  };
}

/**
 * Create or update an announcement. One action for all three buttons (save
 * draft / schedule / publish now) because they only differ by two columns.
 * Redirects to the list on success — announcements are a "done, next" flow.
 */
export async function saveAnnouncement(formData: FormData) {
  const admin = await requireRole("admin");
  const parsed = saveInput.safeParse(readSaveForm(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const input = parsed.data;

  const db = await createClient();
  const status =
    input.intent === "publish" ? "published" : input.intent === "schedule" ? "scheduled" : "draft";

  const row = {
    title: input.title,
    body: input.body,
    is_urgent: input.isUrgent,
    target_section_id: input.targetSectionId,
    image_path: input.imagePath,
    pdf_path: input.pdfPath,
    status,
    scheduled_for:
      input.intent === "schedule" ? fromLocalInput(input.scheduledFor!).toISOString() : null,
    published_at: input.intent === "publish" ? new Date().toISOString() : null,
  };

  let announcementId = input.id;
  if (announcementId) {
    // Republishing an already-published post must not re-notify the res, so
    // keep the original published_at when it had one.
    const { data: existing } = await db
      .from("announcements")
      .select("status, published_at")
      .eq("id", announcementId)
      .single();
    const wasPublished = existing?.status === "published";
    const { error } = await db
      .from("announcements")
      .update({
        ...row,
        published_at: wasPublished ? existing!.published_at : row.published_at,
      })
      .eq("id", announcementId);
    if (error) return { ok: false as const, error: "Could not save the announcement" };
    if (input.intent === "publish" && !wasPublished) {
      await notifyAnnouncementPublished({
        id: announcementId,
        title: input.title,
        body: input.body,
        is_urgent: input.isUrgent,
        target_section_id: input.targetSectionId,
      });
    }
  } else {
    const { data, error } = await db
      .from("announcements")
      .insert({ ...row, author_id: admin.id })
      .select("id")
      .single();
    if (error || !data) return { ok: false as const, error: "Could not save the announcement" };
    announcementId = data.id;
    if (input.intent === "publish") {
      await notifyAnnouncementPublished({
        id: announcementId,
        title: input.title,
        body: input.body,
        is_urgent: input.isUrgent,
        target_section_id: input.targetSectionId,
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/admin/announcements");
  redirect("/admin/announcements");
}

/** Publish a draft or scheduled post straight from the list. */
export async function publishAnnouncement(id: string) {
  await requireRole("admin");
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Unknown announcement" };

  const db = await createClient();
  const { data: existing } = await db
    .from("announcements")
    .select("id, title, body, is_urgent, target_section_id, status")
    .eq("id", parsed.data)
    .single();
  if (!existing) return { ok: false as const, error: "Unknown announcement" };
  if (existing.status === "published") return { ok: true as const };

  const { error } = await db
    .from("announcements")
    .update({ status: "published", published_at: new Date().toISOString(), scheduled_for: null })
    .eq("id", parsed.data);
  if (error) return { ok: false as const, error: "Could not publish it" };

  await notifyAnnouncementPublished(existing);
  revalidatePath("/");
  revalidatePath("/admin/announcements");
  return { ok: true as const };
}

export async function deleteAnnouncement(id: string) {
  await requireRole("admin");
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Unknown announcement" };

  const db = await createClient();
  const { error } = await db.from("announcements").delete().eq("id", parsed.data);
  if (error) return { ok: false as const, error: "Could not delete it" };

  revalidatePath("/");
  revalidatePath("/admin/announcements");
  return { ok: true as const };
}

// --- the shared calendar -----------------------------------------------------
// Admins create events by hand here. Sport fixtures and intersection games are
// NOT created here: their modules mirror them in through src/core/calendar,
// which is why those rows carry a source_module and are read-only in this UI.

const eventInput = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().min(1, "Give the event a name").max(200),
    description: z.string().trim().max(2000),
    // Only the three categories an admin owns; "sport" and "intersection"
    // belong to those modules' mirrors.
    category: z.enum(["res_wide", "section", "social"]),
    sectionId: z.uuid().nullable(),
    location: z.string().trim().max(200),
    startsAt: z.string().min(1, "When does it start?"),
    endsAt: z.string().nullable(),
  })
  .refine((v) => v.category !== "section" || v.sectionId !== null, {
    message: "Pick which section it is for",
    path: ["sectionId"],
  });

export async function saveEvent(formData: FormData) {
  const admin = await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const sectionId = String(formData.get("sectionId") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const parsed = eventInput.safeParse({
    id: id === "" ? undefined : id,
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    category: formData.get("category"),
    sectionId: sectionId === "" ? null : sectionId,
    location: formData.get("location") ?? "",
    startsAt: formData.get("startsAt"),
    endsAt: endsAt === "" ? null : endsAt,
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const input = parsed.data;

  const starts = fromLocalInput(input.startsAt);
  const ends = input.endsAt ? fromLocalInput(input.endsAt) : null;
  if (ends && ends < starts) {
    return { ok: false as const, error: "It cannot end before it starts" };
  }

  const db = await createClient();
  const row = {
    title: input.title,
    description: input.description,
    category: input.category,
    section_id: input.category === "section" ? input.sectionId : null,
    location: input.location,
    starts_at: starts.toISOString(),
    ends_at: ends ? ends.toISOString() : null,
  };

  if (input.id) {
    const { data: existing } = await db
      .from("events")
      .select("starts_at, location, source_module")
      .eq("id", input.id)
      .single();
    if (existing?.source_module) {
      return {
        ok: false as const,
        error: "That event is managed by another part of the app — edit it there.",
      };
    }
    const { error } = await db.from("events").update(row).eq("id", input.id);
    if (error) return { ok: false as const, error: "Could not save the event" };

    // Only tell people when something they would act on actually moved.
    const moved =
      existing?.starts_at !== row.starts_at || (existing?.location ?? "") !== row.location;
    if (moved) {
      await notifyCalendarChange(input.id, `Changed: ${input.title}`, row, starts);
    }
  } else {
    const { data, error } = await db
      .from("events")
      .insert({ ...row, created_by: admin.id })
      .select("id")
      .single();
    if (error || !data) return { ok: false as const, error: "Could not save the event" };
    await notifyCalendarChange(data.id, input.title, row, starts);
  }

  revalidatePath("/");
  revalidatePath("/admin/calendar");
  redirect("/admin/calendar");
}

async function notifyCalendarChange(
  id: string,
  title: string,
  row: { section_id: string | null; location: string },
  starts: Date,
) {
  await notify({
    category: "calendar",
    title,
    body: `${formatDateTime(starts)}${row.location ? ` · ${row.location}` : ""}`,
    url: "/",
    sourceModule: "home",
    sourceRef: id,
    audience: row.section_id ? { kind: "section", sectionId: row.section_id } : { kind: "all" },
    aboutSectionId: row.section_id ?? undefined,
  });
}

export async function deleteEvent(id: string) {
  await requireRole("admin");
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Unknown event" };

  const db = await createClient();
  const { data: existing } = await db
    .from("events")
    .select("source_module")
    .eq("id", parsed.data)
    .single();
  if (existing?.source_module) {
    return {
      ok: false as const,
      error: "That event belongs to another part of the app — remove it there.",
    };
  }

  const { error } = await db.from("events").delete().eq("id", parsed.data);
  if (error) return { ok: false as const, error: "Could not delete the event" };

  revalidatePath("/");
  revalidatePath("/admin/calendar");
  return { ok: true as const };
}

/**
 * "I have seen this." One row per person per announcement; the primary key
 * makes it idempotent. Admins only ever see the COUNT of these rows, through
 * announcement_read_counts() — there is deliberately no policy that would let
 * anyone list who read what (migration 0300).
 */
export async function markAnnouncementRead(id: string) {
  const profile = await requireProfile();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Unknown announcement" };

  const db = await createClient();
  const { error } = await db
    .from("announcement_reads")
    .upsert(
      { announcement_id: parsed.data, profile_id: profile.id },
      { onConflict: "announcement_id,profile_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false as const, error: "Could not record that" };
  return { ok: true as const };
}
