import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Service-role client. BYPASSES RLS — handle with care.
//
// Legitimate uses (the only current ones):
//   - the notification pipeline writing rows for many recipients
//   - src/core/calendar mirroring module fixtures into the events table
//   - the ICS calendar feed (src/core/calendar/ics-feed.ts): a calendar app
//     fetching /api/calendar/<token>.ics has no session for RLS to act as,
//     and the token in the URL is the credential. The query there applies the
//     visibility rule by hand. See docs/DECISIONS.md (2026-08-11).
//   - the cron tick (src/modules/*/lib/tick.ts): /api/cron/tick runs on a
//     schedule with no user at all. It is protected by CRON_SECRET and only
//     does work the app would have done anyway — publishing a post the HK
//     already wrote, reminding people about an event they can already see.
// Everything user-initiated should use the server client (server.ts) so RLS
// stays the enforcement point. If you find yourself reaching for this in a
// module, stop and check whether a policy is missing instead.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
