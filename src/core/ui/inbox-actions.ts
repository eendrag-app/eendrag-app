"use server";

import { z } from "zod";
import { createClient } from "@/core/db/server";
import { EMPTY_INBOX, loadInbox, type Inbox } from "./inbox";

// Server actions behind the bell. Marking read is the only write a user can
// make to their own notifications (RLS: notifications_update_own); the
// pipeline does the inserting with the service role.

const idInput = z.object({ id: z.uuid() });

/** Polled by the bell every 60 seconds. */
export async function refreshInbox(): Promise<Inbox> {
  try {
    return await loadInbox();
  } catch {
    // A flaky network must never break the shell — the next poll retries.
    return EMPTY_INBOX;
  }
}

export async function markNotificationRead(id: string) {
  const parsed = idInput.safeParse({ id });
  if (!parsed.success) return { ok: false as const, error: "Unknown notification" };

  const db = await createClient();
  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .is("read_at", null);
  if (error) return { ok: false as const, error: "Could not mark that as read" };
  return { ok: true as const };
}

export async function markAllNotificationsRead() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in first" };

  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .is("read_at", null);
  if (error) return { ok: false as const, error: "Could not mark them as read" };
  return { ok: true as const };
}
