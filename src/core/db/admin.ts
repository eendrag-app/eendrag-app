import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Service-role client. BYPASSES RLS — handle with care.
//
// Legitimate uses (the only current ones):
//   - the notification pipeline writing rows for many recipients
//   - src/core/calendar mirroring module fixtures into the events table
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
