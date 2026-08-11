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

export function isSunEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@sun.ac.za");
}
