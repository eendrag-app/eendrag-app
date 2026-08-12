import Link from "next/link";
import { Megaphone, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/core/db/server";
import { requireProfile } from "@/core/permissions";
import { EmptyState } from "@/core/ui/empty-state";
import { relativeTime } from "@/core/ui/format";
import { AnnouncementCard } from "../components/announcement-card";
import { FEED_PAGE_SIZE, authorName, partitionFeed } from "../lib/announcements";

// The feed: the reason people open the app. RLS already limits what comes
// back to published posts that are res-wide or aimed at the reader's own
// section, so there is no visibility logic here — just ordering, pinning and
// paging.

const SIGNED_URL_TTL = 60 * 60; // an hour is plenty for one page view

/** PostgREST's or() filter is comma-separated, so a raw query would break it. */
function safeSearchTerm(raw: string): string {
  return raw.replace(/[,()%*\\]/g, " ").trim().slice(0, 80);
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const profile = await requireProfile();
  const params = await searchParams;
  const rawQuery = typeof params.q === "string" ? params.q : "";
  const query = safeSearchTerm(rawQuery);
  const before = typeof params.before === "string" ? params.before : "";

  const db = await createClient();
  let request = db
    .from("announcements")
    // Two things about this string: the foreign keys are named explicitly
    // because announcement_reads also points at both announcements and
    // profiles (a bare `profiles(...)` embed is ambiguous and PostgREST
    // refuses it), and it has to stay ONE literal — supabase-js infers the row
    // type from it, and a concatenated string types as `unknown`.
    .select(
      "id, title, body, is_urgent, is_system, published_at, image_path, pdf_path, author:profiles!announcements_author_id_fkey(full_name), section:sections!announcements_target_section_id_fkey(name)",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    // One extra row tells us whether there is another page.
    .limit(FEED_PAGE_SIZE + 1);
  // RLS already hides other sections' posts from students. Admins can read
  // everything, so the feed says out loud what it wants: your section's posts
  // and the res-wide ones. The admin list is where you see all of them.
  request = profile.section_id
    ? request.or(`target_section_id.is.null,target_section_id.eq.${profile.section_id}`)
    : request.is("target_section_id", null);
  if (query) request = request.or(`title.ilike.%${query}%,body.ilike.%${query}%`);
  if (before) request = request.lt("published_at", before);

  const { data, error } = await request;
  if (error) console.error("feed query failed", error);
  const rows = data ?? [];
  const hasMore = rows.length > FEED_PAGE_SIZE;
  const items = rows.slice(0, FEED_PAGE_SIZE);

  // Which of these has this reader already seen, and signed links for any
  // attachments. Both are one round trip for the whole page.
  const ids = items.map((a) => a.id);
  const paths = items.flatMap((a) => [a.image_path, a.pdf_path].filter((p): p is string => !!p));
  const [reads, signed] = await Promise.all([
    ids.length > 0
      ? db.from("announcement_reads").select("announcement_id").in("announcement_id", ids)
      : Promise.resolve({ data: [] }),
    paths.length > 0
      ? db.storage.from("announcement-attachments").createSignedUrls(paths, SIGNED_URL_TTL)
      : Promise.resolve({ data: [] }),
  ]);
  const readIds = new Set((reads.data ?? []).map((r) => r.announcement_id));
  const urlByPath = new Map(
    (signed.data ?? [])
      .filter((s) => s.signedUrl && s.path)
      .map((s) => [s.path as string, s.signedUrl]),
  );

  const now = new Date();

  const { pinned, rest } = partitionFeed(
    items.map((a) => ({ ...a, isUrgent: a.is_urgent, publishedAt: a.published_at })),
    now,
  );

  const card = (a: (typeof items)[number], isPinned: boolean) => (
    <AnnouncementCard
      key={a.id}
      id={a.id}
      title={a.title}
      body={a.body}
      timeLabel={a.published_at ? relativeTime(a.published_at, now) : ""}
      author={authorName(a.author?.full_name, a.is_system)}
      isUrgent={a.is_urgent}
      pinned={isPinned}
      sectionName={a.section?.name}
      imageUrl={a.image_path ? urlByPath.get(a.image_path) : null}
      pdfUrl={a.pdf_path ? urlByPath.get(a.pdf_path) : null}
      read={readIds.has(a.id)}
    />
  );

  const olderHref = (() => {
    const last = items.at(-1);
    if (!hasMore || !last?.published_at) return null;
    const search = new URLSearchParams({ before: last.published_at });
    if (rawQuery) search.set("q", rawQuery);
    return `/?${search.toString()}`;
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">
          {query ? "Search" : `Hi${profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        </h1>
      </div>

      <form action="/" className="flex gap-2">
        <Input
          name="q"
          type="search"
          defaultValue={rawQuery}
          placeholder="Search announcements"
          aria-label="Search announcements"
          className="h-11"
        />
        <Button type="submit" variant="outline" size="lg" className="h-11">
          <Search aria-hidden />
          <span className="sr-only sm:not-sr-only">Search</span>
        </Button>
      </form>

      {(query || before) && (
        <Link href="/" className="text-muted-foreground hover:text-foreground text-sm underline">
          Back to the latest
        </Link>
      )}

      <div className="space-y-4">
        {items.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={query ? "Nothing matches that" : "No announcements yet"}
            description={
              query
                ? "Try a different word — search looks at titles and the body of every post."
                : "When the HK posts something it lands here, and in your notifications."
            }
          />
        ) : (
          <div className="space-y-4">
            {pinned.length > 0 && (
              <div className="space-y-4">
                {pinned.map((a) => card(a, true))}
                {rest.length > 0 && <Separator />}
              </div>
            )}
            {rest.map((a) => card(a, false))}
          </div>
        )}

        {olderHref && (
          /* nativeButton={false}: this renders an <a>, and Base UI wants to
             be told so it drops the native-button semantics. */
          <Button
            variant="outline"
            size="lg"
            className="h-11 w-full"
            nativeButton={false}
            render={<Link href={olderHref} />}
          >
            Older announcements
          </Button>
        )}
      </div>
    </div>
  );
}
