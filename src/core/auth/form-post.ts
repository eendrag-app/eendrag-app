// Helpers for the two auth route handlers (src/app/auth/*). Kept here rather
// than beside the routes because both need them and neither owns them.
//
// Background: the sign-in and sign-up forms are plain HTML POSTs, not server
// actions. That is deliberate — a real form submission followed by a real
// navigation is what iOS Keychain and Chrome's password manager watch for
// before offering to save a password, and a server action (which submits over
// fetch and never navigates) is invisible to them.
//
// The trade is that a plain route handler does not get the protections Next
// gives server actions for free. These two functions are those protections.

/**
 * Is this POST from our own pages?
 *
 * Next checks the Origin header on every server action; a route handler has
 * to ask for itself, or any site on the web could POST someone's browser at
 * /auth/login and sign them into an account of the attacker's choosing.
 *
 * A missing Origin is treated as a failure: browsers always send it on a
 * cross-origin POST, and same-origin form posts get it too.
 */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  // Behind Vercel (and most proxies) Host is rewritten, so the forwarded
  // header is the one that matches what the browser actually typed.
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Control characters can split a Location header, and no legitimate path has
 * one. Tested by character code rather than by regex on purpose: a literal
 * control character inside a source file is invisible and does not survive
 * being copied between editors.
 */
function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Where to send someone after they sign in, from an untrusted `?next=`.
 *
 * Anything that is not a path on this site becomes "/". Note that a bare
 * `startsWith("/")` is NOT enough, which is what the old server action used:
 * "//evil.com" starts with a slash and is a protocol-relative URL, so the
 * browser cheerfully leaves the site. Backslashes are folded to slashes by
 * some browsers, so "/\evil.com" is the same trick wearing a hat.
 */
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || raw === "") return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (hasControlCharacter(raw)) return "/";
  return raw;
}
