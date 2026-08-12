import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { requireRole } from "@/core/permissions";
import { toLocalInput } from "@/core/ui/format";
import { AnnouncementForm } from "../components/announcement-form";

// Shared by /admin/announcements/new and /admin/announcements/[id] — the only
// difference is whether there is a row to load.
export async function AnnouncementEditor({ id }: { id?: string }) {
  await requireRole("admin");
  const db = await createClient();

  const { data: sections } = await db.from("sections").select("id, name").order("sort_order");

  const existing = id
    ? (
        await db
          .from("announcements")
          .select("id, title, body, is_urgent, target_section_id, image_path, pdf_path, video_path, video_url, scheduled_for, status")
          .eq("id", id)
          .maybeSingle()
      ).data
    : null;
  if (id && !existing) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/admin/announcements"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Announcements
      </Link>
      <h1 className="text-2xl font-semibold">
        {existing ? "Edit announcement" : "New announcement"}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Write it</CardTitle>
          <CardDescription>
            The app is the official record — if it matters, it goes here rather than only in
            a WhatsApp message.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnnouncementForm
            sections={sections ?? []}
            // The cron tick is what releases scheduled posts; without the
            // secret configured it is not running, and the form says so
            // instead of quietly holding the post forever.
            cronWired={Boolean(process.env.CRON_SECRET)}
            values={{
              id: existing?.id,
              title: existing?.title ?? "",
              body: existing?.body ?? "",
              isUrgent: existing?.is_urgent ?? false,
              targetSectionId: existing?.target_section_id ?? "",
              imagePath: existing?.image_path ?? null,
              pdfPath: existing?.pdf_path ?? null,
              videoPath: existing?.video_path ?? null,
              videoUrl: existing?.video_url ?? "",
              scheduledFor: existing?.scheduled_for ? toLocalInput(existing.scheduled_for) : "",
              status: existing?.status ?? "draft",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
