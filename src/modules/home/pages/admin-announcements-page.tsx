import Link from "next/link";
import { ChevronLeft, Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { requireRole } from "@/core/permissions";
import { siteOrigin } from "@/core/site";
import { EmptyState } from "@/core/ui/empty-state";
import { formatDateTime, relativeTime } from "@/core/ui/format";
import {
  AnnouncementAdminList,
  type AdminAnnouncement,
} from "../components/announcement-admin-list";
import type { ShareAttachment } from "../components/share-announcement-button";
import { statusLabel } from "../lib/announcements";
import { attachmentName } from "../lib/share";

export const metadata = { title: "Announcements" };

/** Long enough to open the share sheet and pick a chat; same as the feed. */
const SIGNED_URL_TTL = 60 * 60;

export default async function AdminAnnouncementsPage() {
  await requireRole("admin");
  const db = await createClient();

  // Admins see every status (announcements_select_admin), newest work first.
  const { data } = await db
    .from("announcements")
    // One string literal, or supabase-js cannot infer the row type.
    .select(
      "id, title, body, status, scheduled_for, published_at, created_at, is_urgent, image_path, pdf_path, section:sections!announcements_target_section_id_fkey(name)",
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

  // Signed links for anything the Share button might hand to WhatsApp, in one
  // round trip for the page. Published posts only: those are the ones with a
  // Share button. Uploaded VIDEO is left out on purpose — a 25 MB clip means
  // downloading it to the phone and then uploading it again, and the link in
  // the message plays it in the app for nothing.
  const shareable = rows.filter((r) => r.status === "published");
  const paths = shareable.flatMap((r) =>
    [r.image_path, r.pdf_path].filter((p): p is string => !!p),
  );
  const { data: signed } =
    paths.length > 0
      ? await db.storage.from("announcement-attachments").createSignedUrls(paths, SIGNED_URL_TTL)
      : { data: [] };
  const urlByPath = new Map(
    (signed ?? []).filter((s) => s.signedUrl && s.path).map((s) => [s.path as string, s.signedUrl]),
  );

  function attachmentsFor(row: (typeof rows)[number]): ShareAttachment[] {
    return [
      { path: row.image_path, fallback: "photo", kind: "photo" as const },
      { path: row.pdf_path, fallback: "document.pdf", kind: "document" as const },
    ].flatMap(({ path, fallback, kind }) => {
      const url = path ? urlByPath.get(path) : undefined;
      return url ? [{ url, name: attachmentName(path!, fallback), kind }] : [];
    });
  }

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
    share: r.status === "published" ? { body: r.body, attachments: attachmentsFor(r) } : null,
  }));

  const appUrl = await siteOrigin();

  return (
    <div className="space-y-4">
      <Link
        href="/admin"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Admin
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
            never records who — that is deliberate, not an oversight. &ldquo;Share&rdquo; hands
            a published post, its photo and its PDF to WhatsApp, so nobody types it twice.
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
            <AnnouncementAdminList items={items} appUrl={appUrl} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
