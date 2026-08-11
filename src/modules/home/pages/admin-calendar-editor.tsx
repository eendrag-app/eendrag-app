import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { requireRole } from "@/core/permissions";
import { toLocalInput } from "@/core/ui/format";
import { EventForm } from "../components/event-form";

// Shared by /admin/calendar/new and /admin/calendar/[id].
export async function CalendarEditor({ id }: { id?: string }) {
  await requireRole("admin");
  const db = await createClient();

  const { data: sections } = await db.from("sections").select("id, name").order("sort_order");

  const existing = id
    ? (
        await db
          .from("events")
          .select("id, title, description, category, section_id, location, starts_at, ends_at, source_module")
          .eq("id", id)
          .maybeSingle()
      ).data
    : null;
  if (id && !existing) notFound();
  // Module-mirrored rows are owned by the module that wrote them; editing one
  // here would be undone by the next mirror.
  if (existing?.source_module) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/admin/calendar"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Calendar
      </Link>
      <h1 className="text-2xl font-semibold">{existing ? "Edit event" : "New event"}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm
            sections={sections ?? []}
            values={{
              id: existing?.id,
              title: existing?.title ?? "",
              description: existing?.description ?? "",
              category: existing?.category ?? "res_wide",
              sectionId: existing?.section_id ?? "",
              location: existing?.location ?? "",
              startsAt: existing?.starts_at ? toLocalInput(existing.starts_at) : "",
              endsAt: existing?.ends_at ? toLocalInput(existing.ends_at) : "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
