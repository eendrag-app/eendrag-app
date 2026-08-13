import type { AuthErrorCode } from "./errors";

// Reading Supabase's answers, as pure functions.
//
// Split out of provider.ts so the awkward cases can be tested without a
// network, a database, or a throwaway user in the live project. Every branch
// below is one that actually bit us — see interpret.test.ts.

/** What a signUp call meant. `signedIn: false` = made, but needs confirming. */
export type SignUpOutcome = { ok: true; signedIn: boolean } | { ok: false; code: AuthErrorCode };

interface SupabaseAuthError {
  code?: string;
  status?: number;
}

interface SignUpData {
  user: { identities?: unknown[] | null } | null;
  session: unknown | null;
}

export function interpretSignUp(data: SignUpData, error: SupabaseAuthError | null): SignUpOutcome {
  if (error) {
    if (error.code === "user_already_exists" || error.status === 422) {
      return { ok: false, code: "email_taken" };
    }
    if (error.code === "weak_password") return { ok: false, code: "weak_password" };
    // Supabase checks that the domain can actually receive mail, so a typo
    // like "@gmial.com" lands here. Telling someone the service is down when
    // they mistyped their own address sends them hunting in the wrong place.
    if (error.code === "email_address_invalid") return { ok: false, code: "invalid_email" };
    if (error.code === "over_email_send_rate_limit") {
      return { ok: false, code: "too_many_emails" };
    }
    return { ok: false, code: "unavailable" };
  }

  // With "Confirm email" on, signUp answers an address that already exists
  // with a decoy user instead of an error — deliberate, so the signup form
  // cannot be used to discover who has an account. The decoy has no
  // identities. (With confirmation off, Supabase errors properly instead.)
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, code: "email_taken" };
  }

  // The bug this whole file exists for: with confirmation on, signUp succeeds
  // but returns NO session. The old code went straight on to
  // signInWithPassword, which correctly refused an unconfirmed user — and the
  // refusal was reported as "Wrong email or password" on an account that had
  // just been created a second earlier.
  return { ok: true, signedIn: data.session !== null };
}

/** Which failure a signInWithPassword error really was. */
export function interpretSignInError(error: SupabaseAuthError): AuthErrorCode {
  // Worth separating: "wrong email or password" sends someone hunting for a
  // typo when the real answer is an unopened confirmation email.
  if (error.code === "email_not_confirmed") return "not_confirmed";
  if (error.code === "over_request_rate_limit") return "too_many_attempts";
  return "invalid_credentials";
}
