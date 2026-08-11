import "server-only";
import { createClient } from "@/core/db/server";
import { relativeTime } from "./format";

// The bell's data. Notifications are written by the pipeline
// (src/core/notifications) as one row per recipient; RLS means a signed-in
// user can only ever read their own, so this is a plain select.
//
// Times are formatted here, on the server, and handed to the client as
// strings — see the note at the top of format.ts.

export const INBOX_PAGE_SIZE = 20;

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  url: string;
  category: string;
  timeLabel: string;
  read: boolean;
}

export interface Inbox {
  unread: number;
  items: InboxItem[];
}

export const EMPTY_INBOX: Inbox = { unread: 0, items: [] };

/** The signed-in user's latest notifications + unread count. Empty when signed out. */
export async function loadInbox(): Promise<Inbox> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return EMPTY_INBOX;

  const [list, unread] = await Promise.all([
    db
      .from("notifications")
      .select("id, title, body, url, category, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(INBOX_PAGE_SIZE),
    db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
  ]);

  const now = new Date();
  return {
    unread: unread.count ?? 0,
    items: (list.data ?? []).map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      url: n.url,
      category: n.category,
      timeLabel: relativeTime(n.created_at, now),
      read: n.read_at !== null,
    })),
  };
}
