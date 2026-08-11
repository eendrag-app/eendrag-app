// Pure feed rules — no database, no clock of its own. The page loads rows,
// calls these, and renders. Tested in announcements.test.ts.

/** How long an urgent post stays pinned above everything else. */
export const PIN_WINDOW_MS = 24 * 60 * 60 * 1000;

/** How many announcements one page of the feed shows. */
export const FEED_PAGE_SIZE = 15;

export interface FeedItem {
  id: string;
  isUrgent: boolean;
  publishedAt: string | null;
}

/** Urgent, and published in the last 24 hours. After that it flows normally. */
export function isPinned(item: FeedItem, now: Date): boolean {
  if (!item.isUrgent || !item.publishedAt) return false;
  const age = now.getTime() - new Date(item.publishedAt).getTime();
  return age >= 0 && age < PIN_WINDOW_MS;
}

/**
 * Split a reverse-chronological page into the urgent posts pinned at the top
 * and everything else, without ever showing the same post twice.
 */
export function partitionFeed<T extends FeedItem>(
  items: T[],
  now: Date,
): { pinned: T[]; rest: T[] } {
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    (isPinned(item, now) ? pinned : rest).push(item);
  }
  return { pinned, rest };
}

/**
 * Who a post is from. A null author means the account was removed or the app
 * wrote it (a sport result, say) — either way the res reads it as "the HK".
 */
export function authorName(fullName: string | null | undefined, isSystem: boolean): string {
  if (isSystem || !fullName || fullName.trim() === "") return "Eendrag HK";
  return fullName;
}

/** Human status for the admin list. */
export function statusLabel(status: string, scheduledFor: string | null): string {
  if (status === "published") return "Published";
  if (status === "scheduled") return scheduledFor ? "Scheduled" : "Scheduled (no time set)";
  return "Draft";
}
