import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Welcome to Eendrag</h1>
      <Card>
        <CardContent>
          <OnboardingForm sections={sections ?? []} sports={sports ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
