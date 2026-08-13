import "server-only";
import { createClient } from "@/core/db/server";
import { authMode, isSunEmail, requireSunEmail } from "./config";
import type { AuthErrorCode } from "./errors";
import { interpretSignInError, interpretSignUp, type SignUpOutcome } from "./interpret";

// The auth provider — the ONE file that knows how signing in works.
// Current mode ("open"): email + password, anyone can sign up. This is
// deliberate for the pilot; see docs/ARCHITECTURE.md → Auth for the planned
// switch to @sun.ac.za magic links (one file + one flag).
//
// Callers get a CODE, not a message: these run inside route handlers that
// redirect on failure, and the failure has to survive a trip through a URL.
// The wording lives in errors.ts.

export type AuthResult = { ok: true } | { ok: false; code: AuthErrorCode };

/** signUp also reports whether a session was actually established —
 *  `signedIn: false` means the account exists but needs email confirmation. */
export type SignUpResult = SignUpOutcome;

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  if (requireSunEmail() && !isSunEmail(email)) {
    return { ok: false, code: "not_sun_email" };
  }
  if (authMode() === "sun_email_magic_link") {
    // The future flow: check verified_emails, then signInWithOtp — no
    // password at all. Implemented when the flag flips; the database side
    // (verified_emails) already exists.
    return { ok: false, code: "not_enabled" };
  }

  const db = await createClient();
  const { data, error } = await db.auth.signUp({ email, password });
  // Every awkward branch of that answer is read in interpret.ts, where it can
  // be tested without a live project.
  return interpretSignUp(data, error);
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (authMode() === "sun_email_magic_link") {
    return { ok: false, code: "not_enabled" };
  }
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, code: interpretSignInError(error) };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const db = await createClient();
  await db.auth.signOut();
}

/** The signed-in auth user, or null. For the profile row use
 *  getProfile() from @/core/permissions instead. */
export async function getUser() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  return user;
}
