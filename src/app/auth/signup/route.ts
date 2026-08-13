import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/core/auth/form-post";
import { signUp } from "@/core/auth/provider";
import type { AuthErrorCode } from "@/core/auth/errors";

// Sign-up as a plain HTML form POST — same reasoning as the login route.
// Signing up is the moment that matters most for password managers: iOS
// offers to generate and save a strong password here, which for 280 students
// is the difference between everyone having a password they never typed and
// everyone reusing one they will forget.

const input = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

function back(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/signup", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

function failed(request: NextRequest, code: AuthErrorCode) {
  return back(request, { error: code });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers)) {
    return new NextResponse("Bad origin", { status: 403 });
  }

  const form = await request.formData();
  const email = form.get("email");
  const parsed = input.safeParse({ email, password: form.get("password") });
  if (!parsed.success) {
    const failure = parsed.error.issues[0];
    return failed(request, failure.path[0] === "password" ? "weak_password" : "invalid_email");
  }

  const created = await signUp(parsed.data.email, parsed.data.password);
  if (!created.ok) return failed(request, created.code);

  // "Confirm email" is on in the Supabase project: the account exists but
  // cannot sign in until the link is clicked. Say so, instead of trying to
  // sign in and reporting the refusal as a wrong password.
  if (!created.signedIn) return back(request, { sent: "1" });

  // Confirmation is off, so signUp already established the session. No second
  // round trip through signInWithPassword — that call was where the old bug
  // lived, and it is not needed when a session is already in hand.
  return NextResponse.redirect(new URL("/onboarding", request.url), 303);
}
