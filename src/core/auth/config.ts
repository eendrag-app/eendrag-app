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

/**
 * Demo mode, for before launch: every visitor who is not signed in is signed
 * in as this one shared account, so anyone with the link sees the whole app.
 * Point it at an admin and they see the admin screens too.
 *
 * ON only when BOTH DEMO_LOGIN_EMAIL and DEMO_LOGIN_PASSWORD are set. Remove
 * them (and redeploy) to put the login back — docs/OPERATIONS.md → Demo mode.
 */
export function demoAccount(
  env: Record<string, string | undefined> = process.env,
): { email: string; password: string } | null {
  const email = env.DEMO_LOGIN_EMAIL?.trim();
  const password = env.DEMO_LOGIN_PASSWORD;
  if (!email || !password?.trim()) return null;
  return { email, password };
}

export function isSunEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@sun.ac.za");
}
