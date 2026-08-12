import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

// Session refresh for middleware. Refreshes the Supabase session cookie on
// every request and reports who (if anyone) is signed in. Route protection
// itself lives in src/middleware.ts, which knows the module registry — core
// deliberately does not.

/**
 * Does this request carry a Supabase session cookie at all?
 *
 * The difference between "signed out" and "we could not check right now"
 * matters: on campus wifi `getUser()` can fail on a dropped connection, and
 * treating that as signed-out would throw someone back to the login screen
 * mid-scroll — the thing the HK complained about. See updateSession.
 */
function hasSessionCookie(request: NextRequest): boolean {
  // @supabase/ssr names them sb-<project-ref>-auth-token[.0], [.1], …
  return request.cookies.getAll().some((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
}

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null; maybeSignedIn: boolean }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session cookie if expired — must run on every request.
  //
  // `error` is deliberately kept: a network failure talking to Supabase and a
  // genuinely signed-out visitor both come back as `user: null`, and only one
  // of them should be sent to the login page.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Was this a real "no", or could we not reach Supabase to ask? An expired or
  // revoked session answers with an HTTP status (400 session-missing, 401
  // invalid-token); a dropped connection has no status at all. Only the second
  // kind is worth ignoring.
  const status = (error as { status?: number } | null)?.status;
  const couldNotCheck = error !== null && (status === undefined || status === 0 || status >= 500);

  // "Might still be signed in": we hold a session cookie and the check itself
  // failed. The page behind it still enforces everything — requireProfile()
  // redirects and RLS returns nothing — so letting the request through costs no
  // access, and saves a re-login every time campus wifi hiccups.
  const maybeSignedIn = user !== null || (couldNotCheck && hasSessionCookie(request));

  return { response, user, maybeSignedIn };
}
