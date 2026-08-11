import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  // Keep ?next= working: middleware sends signed-out visitors here with the
  // page they wanted, and the form carries it through the sign-in.
  const next = typeof params.next === "string" ? params.next : "/";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sign in to Eendrag</h1>
      <Card>
        <CardContent className="space-y-4">
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
