// The things that can go wrong signing in or signing up, as short codes.
//
// Why codes and not messages: the sign-in forms POST to a route handler and
// are redirected back on failure, so the failure has to survive a trip
// through a URL. A code is safe to put there; the message it maps to can be
// rewritten without touching the routes, and nothing personal (an email, a
// raw Supabase error) ever lands in a Vercel access log.

export const AUTH_ERRORS = {
  invalid_email: "Enter a valid email address",
  invalid_credentials: "Wrong email or password",
  weak_password: "Password must be at least 8 characters",
  email_taken: "There is already an account with that email — sign in instead",
  // Only reachable while "Confirm email" is on in the Supabase dashboard.
  // See signUp() in provider.ts for why this used to surface as
  // "Wrong email or password" on a brand-new account.
  needs_confirmation: "Check your email for a confirmation link, then sign in",
  not_confirmed: "Confirm your email address first — check your inbox for the link",
  not_sun_email: "Use your @sun.ac.za student email address",
  // Deliberately says who to ask rather than "access denied": the usual cause
  // is a resident the HK has not added yet, or a typo in their address.
  not_on_list: "That address is not on the res list — ask the HK to add it",
  not_enabled: "That way of signing in is not switched on",
  // Supabase's own limits. The email one is the reason a res-wide signup
  // evening needs real SMTP configured — see docs/OPERATIONS.md → Auth.
  too_many_emails: "Too many confirmation emails just went out — wait a minute and try again",
  too_many_attempts: "Too many tries — wait a minute and try again",
  unavailable: "Could not reach the sign-in service — try again in a moment",
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERRORS;

/** The message for a code off a query string, or null if it is not one. */
export function authErrorMessage(code: unknown): string | null {
  if (typeof code !== "string") return null;
  return code in AUTH_ERRORS ? AUTH_ERRORS[code as AuthErrorCode] : null;
}
