import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account" };

// The page heading sits above the card rather than inside it: CardTitle is an
// <h3>, and the one heading on an auth screen should be the page's <h1>.
export default function SignupPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <Card>
        <CardContent className="space-y-4">
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
