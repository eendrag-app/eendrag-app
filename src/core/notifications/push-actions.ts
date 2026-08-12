"use server";

import { z } from "zod";
import { createClient } from "@/core/db/server";
import { requireProfile } from "@/core/permissions";

// Registering a device for push. Deliberately the USER'S client, not the admin
// one: the RLS policies on push_subscriptions (migration 0105) are what
// guarantee nobody can register a device against somebody else's name, or read
// back the keys that would let them buzz another person's phone.

const subscriptionInput = z.object({
  // The push service's URL for this device. Long, opaque, vendor-specific.
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  userAgent: z.string().max(300),
});

export type SubscriptionInput = z.infer<typeof subscriptionInput>;

export async function savePushSubscription(input: SubscriptionInput) {
  const profile = await requireProfile();
  const parsed = subscriptionInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "That subscription looks wrong" };

  const db = await createClient();
  const { error } = await db.from("push_subscriptions").upsert(
    {
      profile_id: profile.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.userAgent,
      last_seen_at: new Date().toISOString(),
    },
    // A browser that re-subscribes hands back the SAME endpoint, and we want
    // that to refresh the row rather than pile up duplicates and push twice.
    { onConflict: "endpoint" },
  );
  if (error) {
    // The one case that lands here in practice: this exact browser is already
    // registered to a different account (someone signed in on a friend's
    // phone). RLS refuses to overwrite their row, which is the right answer.
    console.error("could not save push subscription", error);
    return {
      ok: false as const,
      error: "This browser is already signed up for notifications under another account.",
    };
  }
  return { ok: true as const };
}

export async function removePushSubscription(endpoint: string) {
  await requireProfile();
  const parsed = z.string().url().max(2000).safeParse(endpoint);
  if (!parsed.success) return { ok: false as const, error: "Unknown device" };

  const db = await createClient();
  // No profile filter needed: the delete policy only exposes your own rows.
  const { error } = await db.from("push_subscriptions").delete().eq("endpoint", parsed.data);
  if (error) return { ok: false as const, error: "Could not turn them off" };
  return { ok: true as const };
}
