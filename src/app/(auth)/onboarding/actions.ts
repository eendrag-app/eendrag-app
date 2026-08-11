"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/core/db/server";

const input = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(120),
  sectionId: z.string().uuid("Choose your section"),
  roomNumber: z.string().trim().max(20),
  sportIds: z.array(z.string().uuid()).max(50),
});

export async function onboardingAction(formData: FormData) {
  const parsed = input.safeParse({
    fullName: formData.get("fullName"),
    sectionId: formData.get("sectionId"),
    roomNumber: formData.get("roomNumber") ?? "",
    sportIds: formData.getAll("sportIds").map(String),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await db
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      section_id: parsed.data.sectionId,
      room_number: parsed.data.roomNumber,
    })
    .eq("id", user.id);
  if (error) return { ok: false as const, error: "Could not save your details" };

  // Replace sports played wholesale — simplest correct behaviour for a form.
  await db.from("user_sports").delete().eq("profile_id", user.id);
  if (parsed.data.sportIds.length > 0) {
    const { error: sportsError } = await db.from("user_sports").insert(
      parsed.data.sportIds.map((sportId) => ({
        profile_id: user.id,
        sport_id: sportId,
      })),
    );
    if (sportsError) return { ok: false as const, error: "Could not save your sports" };
  }

  redirect("/");
}
