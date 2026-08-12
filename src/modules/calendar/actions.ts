"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/core/db/server";
import { notify } from "@/core/notifications";
import { requireRole } from "@/core/permissions";
import { formatDateTime, fromLocalInput } from "@/core/ui/format";

// The shared calendar. Admins create events by hand here. Sport fixtures and
// intersection games are NOT created here: their modules mirror them in
// through src/core/calendar, which is why those rows carry a source_module and
// are read-only in this UI.

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

  revalidatePath("/calendar");
  revalidatePath("/calendar/admin");
  redirect("/calendar/admin");
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
    url: "/calendar",
    sourceModule: "calendar",
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

  revalidatePath("/calendar");
  revalidatePath("/calendar/admin");
  return { ok: true as const };
}
