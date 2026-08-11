import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

// Supabase client for server components, server actions, and route handlers.
// Carries the signed-in user's session from cookies — every query passes
// through RLS. This is the default client; only the notification pipeline and
// calendar mirroring use the admin client (see admin.ts).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a server component, where cookies are read-only.
            // Safe to ignore: middleware refreshes the session cookie.
          }
        },
      },
    },
  );
}
