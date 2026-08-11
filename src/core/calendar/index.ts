import "server-only";
import { createAdminClient } from "@/core/db/admin";
import { createClient } from "@/core/db/server";

// The calendar service. ONE events table is the single source of truth for
// every date in the app; modules never keep a parallel calendar. Manual
// events are created by admins straight through RLS; module-generated entries
// (sport fixtures, intersection draws) go through upsertModuleEvent /
// removeModuleEvent below, keyed on (sourceModule, sourceRef) so writing the
// same source twice updates instead of duplicating, and deleting the source
// removes the calendar entry.

export type EventCategory = "res_wide" | "intersection" | "section" | "social" | "sport";

export interface ModuleEventInput {
  sourceModule: string; // module id, e.g. "sport"
  sourceRef: string; // stable per source row, e.g. the fixture id
  title: string;
  description?: string;
  category: EventCategory;
  sectionId?: string | null;
  location?: string;
  startsAt: Date;
  endsAt?: Date | null;
}

/** Create or update the calendar entry mirroring a module row. */
export async function upsertModuleEvent(input: ModuleEventInput): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("events").upsert(
    {
      source_module: input.sourceModule,
      source_ref: input.sourceRef,
      title: input.title,
      description: input.description ?? "",
      category: input.category,
      section_id: input.sectionId ?? null,
      location: input.location ?? "",
      starts_at: input.startsAt.toISOString(),
      ends_at: input.endsAt ? input.endsAt.toISOString() : null,
    },
    { onConflict: "source_module,source_ref" },
  );
  if (error) throw error;
}

/** Remove the calendar entry for a deleted module row. Safe if none exists. */
export async function removeModuleEvent(
  sourceModule: string,
  sourceRef: string,
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("events")
    .delete()
    .eq("source_module", sourceModule)
    .eq("source_ref", sourceRef);
  if (error) throw error;
}

/**
 * Events between two instants, as the signed-in user (RLS applies).
 * For the month grid and agenda views.
 */
export async function listEventsBetween(from: Date, to: Date) {
  const db = await createClient();
  const { data, error } = await db
    .from("events")
    .select("*")
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");
  if (error) throw error;
  return data;
}
