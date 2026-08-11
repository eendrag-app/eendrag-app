import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/core/auth/middleware";
import { moduleForPath } from "@/modules/registry";

// App-level wiring: refresh the session (core), then gate routes by what the
// module registry declares (AppModule.requiresAuth). Nothing per-module is
// hardcoded here — registering a module IS the route-protection config.

const ALWAYS_PUBLIC = ["/login", "/signup", "/auth"];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const path = request.nextUrl.pathname;
  const isPublicPage = ALWAYS_PUBLIC.some((p) => path === p || path.startsWith(p + "/"));
  // Unrouted paths 404 on their own; treat them as not-protected.
  const needsAuth = moduleForPath(path)?.requiresAuth ?? false;

  if (!user && needsAuth && !isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except static assets and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
