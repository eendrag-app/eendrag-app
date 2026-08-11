import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Supabase client for client components. Anon key + the signed-in user's
// session — every query passes through RLS.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
