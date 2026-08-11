import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to Eendrag</CardTitle>
      </CardHeader>
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
  );
}
