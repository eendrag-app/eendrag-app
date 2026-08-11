"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/core/db/server";
import { requireProfile, requireRole } from "@/core/permissions";
import { fromLocalInput } from "@/core/ui/format";
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
