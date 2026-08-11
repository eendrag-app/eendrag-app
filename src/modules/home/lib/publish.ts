import "server-only";
import { notify } from "@/core/notifications";

// The one place that decides what publishing an announcement notifies. Both
// the admin "Publish" button and the cron tick that releases scheduled posts
// call this, so a scheduled post behaves exactly like one sent by hand.

export interface PublishedAnnouncement {
  id: string;
  title: string;
  body: string;
  is_urgent: boolean;
  target_section_id: string | null;
}

/** First sentence-ish of the body, for the notification and the bell. */
export function announcementExcerpt(body: string, max = 140): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : flat.slice(0, max - 1).trimEnd() + "…";
}

export async function notifyAnnouncementPublished(
  announcement: PublishedAnnouncement,
): Promise<number> {
  return notify({
    // Urgent posts go out under the 'urgent' category: they bypass quiet
    // hours and can only be silenced with the dedicated urgent toggle.
    category: announcement.is_urgent ? "urgent" : "announcement",
    urgent: announcement.is_urgent,
    title: announcement.title,
    body: announcementExcerpt(announcement.body),
    url: "/",
    sourceModule: "home",
    sourceRef: announcement.id,
    audience: announcement.target_section_id
      ? { kind: "section", sectionId: announcement.target_section_id }
      : { kind: "all" },
    aboutSectionId: announcement.target_section_id ?? undefined,
  });
}
