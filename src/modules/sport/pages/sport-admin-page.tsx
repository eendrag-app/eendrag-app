import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { requireRole } from "@/core/permissions";
import { EmptyState } from "@/core/ui/empty-state";
import { SportAdminList, type AdminSport } from "../components/sport-admin-list";

export const metadata = { title: "Sports & reps" };

// Declared as this module's admin panel, so it appears on the Admin tab
// tools for admins and sport reps. Admins get the catalogue; a rep gets a way
// into their own sport's page, where their editing actually lives.
export default async function SportAdminPage() {
  const profile = await requireRole("admin", "sport_rep");
  const db = await createClient();
  const isAdmin = profile.role === "admin";

  const { data: sports } = await db
    .from("sports")
    .select("id, name, is_active, rep_id, rep_name, rep_phone, rep_email")
    .order("name");

  const mine = (sports ?? []).filter((s) => s.rep_id === profile.id);

  const rows: AdminSport[] = (sports ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    isActive: s.is_active,
    repName: s.rep_name,
    repPhone: s.rep_phone,
    repEmail: s.rep_email,
    // rep_id is only set once the email matches a real account — that is the
    // moment the rep can actually edit anything.
    repLinked: s.rep_id !== null,
  }));

  return (
    <div className="space-y-4">
      <Link
        href="/profile"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Profile
      </Link>
      <h1 className="text-2xl font-semibold">Sports &amp; reps</h1>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>The catalogue</CardTitle>
            <CardDescription>
              Pausing a sport hides it from the Sport tab without losing its fixtures or
              results. Type the rep&apos;s name and number for the contact card; their student
              email is what lets them edit practice times, fixtures and results on the
              sport&apos;s own page. You can appoint someone before they have an account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SportAdminList sports={rows} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your sport</CardTitle>
            <CardDescription>
              You edit practice times, fixtures and results on the sport&apos;s own page —
              the same page everyone else reads.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mine.length === 0 ? (
              <EmptyState
                title="You do not run a sport yet"
                description="The HK appoints reps here. Ask them if you think this is wrong."
              />
            ) : (
              <ul className="divide-y">
                {mine.map((sport) => (
                  <li key={sport.id}>
                    <Link
                      href={`/sport/${sport.id}`}
                      className="hover:bg-muted/60 -mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2"
                    >
                      <span className="flex-1 text-sm font-medium">{sport.name}</span>
                      <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
