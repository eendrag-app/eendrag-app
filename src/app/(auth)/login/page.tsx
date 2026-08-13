import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { authErrorMessage } from "@/core/auth/errors";
import { safeNext } from "@/core/auth/form-post";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  // Keep ?next= working: middleware sends signed-out visitors here with the
  // page they wanted, and the form carries it through the sign-in. safeNext
  // is what stops "//evil.com" from turning the sign-in into an open redirect.
  const next = safeNext(params.next);
  // A failed attempt comes back as a fresh page load carrying a code, because
  // the form is a real POST rather than a server action (see login-form.tsx).
  const error = authErrorMessage(params.error);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sign in to Eendrag</h1>
      <Card>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <LoginForm next={next} />
          <p className="text-muted-foreground text-sm">
            New here?{" "}
            <Link className="underline" href="/signup">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
