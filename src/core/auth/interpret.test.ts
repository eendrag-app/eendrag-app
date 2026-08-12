import { describe, expect, it } from "vitest";
import { interpretSignInError, interpretSignUp } from "./interpret";

// The cases here are the ones that cannot be reached from a test against the
// live project without creating real users and sending real email, which is
// exactly why reading the answer is a pure function.

const noUser = { user: null, session: null };

describe("interpretSignUp", () => {
  it("signs someone straight in when confirmation is off", () => {
    const result = interpretSignUp(
      { user: { identities: [{}] }, session: { access_token: "x" } },
      null,
    );
    expect(result).toEqual({ ok: true, signedIn: true });
  });

  // The reported bug: creating a brand-new account said "Wrong email or
  // password". Confirmation is on, so signUp succeeds with no session; the
  // old code then tried to sign in and reported the refusal as bad
  // credentials. The account must be reported as made-but-unconfirmed.
  it("reports an account that still needs confirming, rather than failing", () => {
    const result = interpretSignUp({ user: { identities: [{}] }, session: null }, null);
    expect(result).toEqual({ ok: true, signedIn: false });
  });

  it("spots the decoy user Supabase returns for an address that already exists", () => {
    // No error and no session, same as above — the empty identities array is
    // the ONLY thing distinguishing "already taken" from "go and confirm".
    const result = interpretSignUp({ user: { identities: [] }, session: null }, null);
    expect(result).toEqual({ ok: false, code: "email_taken" });
  });

  it("reads an explicit already-registered error", () => {
    expect(interpretSignUp(noUser, { code: "user_already_exists" })).toEqual({
      ok: false,
      code: "email_taken",
    });
    expect(interpretSignUp(noUser, { status: 422 })).toEqual({ ok: false, code: "email_taken" });
  });

  it("blames the address, not the service, when the domain cannot receive mail", () => {
    // Supabase checks for an MX record, so "@eendrag.dev" and "@gmial.com"
    // both land here. Reported as "service unavailable" this is unfixable
    // from the student's side.
    expect(interpretSignUp(noUser, { code: "email_address_invalid" })).toEqual({
      ok: false,
      code: "invalid_email",
    });
  });

  it("names the email rate limit, which a res-wide signup evening will hit", () => {
    expect(interpretSignUp(noUser, { code: "over_email_send_rate_limit" })).toEqual({
      ok: false,
      code: "too_many_emails",
    });
  });

  it("passes a weak password through as itself", () => {
    expect(interpretSignUp(noUser, { code: "weak_password" })).toEqual({
      ok: false,
      code: "weak_password",
    });
  });

  it("falls back to unavailable for anything unrecognised", () => {
    expect(interpretSignUp(noUser, { code: "something_new", status: 500 })).toEqual({
      ok: false,
      code: "unavailable",
    });
  });
});

describe("interpretSignInError", () => {
  it("separates an unconfirmed account from a wrong password", () => {
    expect(interpretSignInError({ code: "email_not_confirmed" })).toBe("not_confirmed");
  });

  it("names the rate limit", () => {
    expect(interpretSignInError({ code: "over_request_rate_limit" })).toBe("too_many_attempts");
  });

  it("treats everything else as bad credentials, revealing nothing", () => {
    // Deliberately vague: distinguishing "no such account" from "wrong
    // password" tells a stranger who has an account here.
    expect(interpretSignInError({ code: "invalid_credentials" })).toBe("invalid_credentials");
    expect(interpretSignInError({})).toBe("invalid_credentials");
  });
});
