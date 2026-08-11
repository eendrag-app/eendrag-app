import Link from "next/link";
import { ChevronLeft, Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { requireRole } from "@/core/permissions";
import { EmptyState } from "@/core/ui/empty-state";
import { formatDateTime, relativeTime } from "@/core/ui/format";
import {
  AnnouncementAdminList,
  type AdminAnnouncement,
} from "../components/announcement-admin-list";
import { statusLabel } from "../lib/announcements";

export const metadata = { title: "Announcements" };

export default async function AdminAnnouncementsPage() {
  await requireRole("admin");
  const db = await createClient();

  // Admins see every status (announcements_select_admin), newest work first.
  const { data } = await db
    .from("announcements")
    // One string literal, or supabase-js cannot infer the row type.
    .select(
      "id, title, status, scheduled_for, published_at, created_at, is_urgent, section:sections!announcements_target_section_id_fkey(name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];

  // Counts only — announcement_read_counts() returns numbers and nothing else.
  const publishedIds = rows.filter((r) => r.status === "published").map((r) => r.id);
  const { data: counts } = publishedIds.length
    ? await db.rpc("announcement_read_counts", { announcement_ids: publishedIds })
    : { data: [] };
  const countById = new Map((counts ?? []).map((c) => [c.announcement_id, Number(c.read_count)]));

  const now = new Date();
  const items: AdminAnnouncement[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    statusLabel: statusLabel(r.status, r.scheduled_for),
    whenLabel:
      r.status === "published" && r.published_at
        ? `Published ${relativeTime(r.published_at, now)}`
        : r.status === "scheduled" && r.scheduled_for
          ? `Goes out ${formatDateTime(r.scheduled_for)}`
          : `Saved ${relativeTime(r.created_at, now)}`,
    isUrgent: r.is_urgent,
    sectionName: r.section?.name ?? null,
    readCount: r.status === "published" ? (countById.get(r.id) ?? 0) : null,
  }));

  return (
    <div className="space-y-4">
      <Link
        href="/profile"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Profile
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Announcements</h1>
        <Button
          size="lg"
          className="h-11"
          nativeButton={false}
          render={<Link href="/admin/announcements/new" />}
        >
          <Plus aria-hidden />
          New announcement
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Everything you have posted</CardTitle>
          <CardDescription>
            &ldquo;Opened&rdquo; is how many people have seen the post in their feed. The app
            never records who — that is deliberate, not an oversight.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Nothing posted yet"
              description="Write the first one — it lands in everyone's feed and notifications."
            />
          ) : (
            <AnnouncementAdminList items={items} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
