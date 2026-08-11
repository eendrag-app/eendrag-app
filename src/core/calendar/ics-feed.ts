import "server-only";
import { createAdminClient } from "@/core/db/admin";
import { buildIcs } from "./ics";

// The personal calendar feed behind /api/calendar/<calendar_token>.ics.
//
// This is the third sanctioned use of the service-role client (see
// src/core/db/admin.ts and docs/DECISIONS.md): a calendar app fetching the
// URL has no session and no cookies, so RLS has nobody to be. The token in
// the URL IS the credential — which is why Profile can regenerate it. The
// query below applies by hand exactly what the RLS policy would: res-wide
// events, plus the token owner's own section.

const PAST_DAYS = 30;
const FUTURE_DAYS = 365;

/**
 * The feed for one calendar token, or null when the token is unknown or the
 * account has been deactivated.
 */
export async function calendarFeedForToken(token: string): Promise<string | null> {
  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("id, section_id, is_active")
    .eq("calendar_token", token)
    .maybeSingle();
  if (!profile || !profile.is_active) return null;

  const from = new Date(Date.now() - PAST_DAYS * 86_400_000);
  const to = new Date(Date.now() + FUTURE_DAYS * 86_400_000);

  let query = db
    .from("events")
    .select("id, title, description, location, starts_at, ends_at, section_id")
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");
  query = profile.section_id
    ? query.or(`section_id.is.null,section_id.eq.${profile.section_id}`)
    : query.is("section_id", null);

  const { data: events, error } = await query;
  if (error) throw error;

  return buildIcs(
    "Eendrag",
    (events ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      location: e.location,
      startsAt: new Date(e.starts_at),
      endsAt: e.ends_at ? new Date(e.ends_at) : null,
    })),
  );
}
