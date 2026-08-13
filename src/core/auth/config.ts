// Auth configuration. The mode is a deployment decision, not a code change —
// see docs/ARCHITECTURE.md → Auth for exactly what flipping it involves.
export type AuthMode = "open" | "sun_email_magic_link";

export function authMode(): AuthMode {
  const mode = process.env.AUTH_MODE ?? "open";
  if (mode !== "open" && mode !== "sun_email_magic_link") {
    throw new Error(`Invalid AUTH_MODE "${mode}" — use "open" or "sun_email_magic_link"`);
  }
  return mode;
}

// Independently of the mode: reject signups whose email is not @sun.ac.za.
export function requireSunEmail(): boolean {
  return process.env.REQUIRE_SUN_EMAIL === "true";
}

/**
 * Independently again: only addresses on the HK's list of residents may
 * create an account (`verified_emails`, filled by scripts/import-residents.mjs).
 *
 * This is what replaces email confirmation. With confirmation off — which it
 * has to be, because Supabase's built-in mailer cannot deliver 280 of them in
 * one evening — nothing else proves the person typing an address should be in
 * the app at all.
 */
export function requireVerifiedEmail(): boolean {
  return process.env.REQUIRE_VERIFIED_EMAIL === "true";
}

export function isSunEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@sun.ac.za");
}
