import "server-only";
import { createClient } from "@/core/db/server";
import { authMode, isSunEmail, requireSunEmail } from "./config";

// The auth provider — the ONE file that knows how signing in works.
// Current mode ("open"): email + password, no email confirmation, anyone can
// sign up. This is deliberate for the pilot; see docs/ARCHITECTURE.md → Auth
// for the planned switch to @sun.ac.za magic links (one file + one flag).

export type AuthResult = { ok: true } | { ok: false; error: string };

export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (requireSunEmail() && !isSunEmail(email)) {
    return { ok: false, error: "Use your @sun.ac.za student email address" };
  }
  if (authMode() === "sun_email_magic_link") {
    // The future flow: check verified_emails, then signInWithOtp — no
    // password at all. Implemented when the flag flips; the database side
    // (verified_emails) already exists.
    return { ok: false, error: "Magic-link signup is not enabled yet" };
  }

  const db = await createClient();
  const { error } = await db.auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (authMode() === "sun_email_magic_link") {
    return { ok: false, error: "Magic-link sign-in is not enabled yet" };
  }
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "Wrong email or password" };
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
