import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOrigin, safeNext } from "@/core/auth/form-post";
import { signIn } from "@/core/auth/provider";
import type { AuthErrorCode } from "@/core/auth/errors";

// Sign-in as a plain HTML form POST.
//
// Why this is a route handler and not a server action: a server action
// submits over fetch and never navigates, and password managers only offer to
// save a password after a real submit-then-navigate. Everyone was retyping
// their password on every visit because iOS Keychain never saw a sign-in
// happen. See src/core/auth/form-post.ts.
//
// The session cookie is written by signIn() through cookies() from
// next/headers, which IS writable inside a route handler (unlike a server
// component), and Next merges it onto whatever response we return.

const input = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function backToLogin(request: NextRequest, code: AuthErrorCode, next: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", code);
  // Carry the destination so a mistyped password does not also lose the page
  // the person was trying to reach. The email is deliberately NOT carried:
  // query strings end up in access logs, and autofill refills it anyway.
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers)) {
    return new NextResponse("Bad origin", { status: 403 });
  }

  const form = await request.formData();
  const next = safeNext(form.get("next"));

  const parsed = input.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return backToLogin(request, "invalid_email", next);

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) return backToLogin(request, result.code, next);

  // 303, not the 307 NextResponse.redirect defaults to: 307 preserves the
  // method, which would re-POST the credentials at the home page.
  return NextResponse.redirect(new URL(next, request.url), 303);
}
