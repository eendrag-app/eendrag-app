import "server-only";
import { headers } from "next/headers";

/**
 * The origin this request arrived on — "https://eendrag.vercel.app",
 * "http://localhost:3000", or whatever the university server ends up being.
 *
 * Derived from the request rather than from an environment variable so that
 * preview deploys, the Docker container, and localhost all print correct
 * links without configuration. NEXT_PUBLIC_SITE_URL is only the fallback for
 * contexts with no request (a cron tick, say).
 */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
