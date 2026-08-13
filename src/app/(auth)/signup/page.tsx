import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { authErrorMessage } from "@/core/auth/errors";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account" };

// The page heading sits above the card rather than inside it: CardTitle is an
// <h3>, and the one heading on an auth screen should be the page's <h1>.
export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  const error = authErrorMessage(params.error);
  // ?sent=1 means the account was created but the Supabase project has
  // "Confirm email" switched on, so there is no session yet. Before this
  // existed the code tried to sign in anyway and reported the refusal as
  // "Wrong email or password" on a brand-new account.
  const confirmationSent = params.sent === "1";

  if (confirmationSent) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm">
              Your account is made. Open the confirmation link we just sent you, then sign in.
            </p>
            <p className="text-muted-foreground text-sm">
              Nothing arrived? Look in your spam folder, or ask the HK to confirm you manually.
            </p>
            <Link className="text-sm underline" href="/login">
              Go to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <Card>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <SignupForm />
          <p className="text-muted-foreground text-sm">
            Already have an account?{" "}
            <Link className="underline" href="/login">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
