import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: sections }, { data: sports }] = await Promise.all([
    db.from("sections").select("id, name").order("sort_order"),
    db.from("sports").select("id, name").eq("is_active", true).order("name"),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome to Eendrag</CardTitle>
      </CardHeader>
      <CardContent>
        <OnboardingForm sections={sections ?? []} sports={sports ?? []} />
      </CardContent>
    </Card>
  );
}
