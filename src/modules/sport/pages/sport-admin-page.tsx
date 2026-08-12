import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { requireRole } from "@/core/permissions";
import { EmptyState } from "@/core/ui/empty-state";
import {
  SportAdminList,
  type AdminSport,
  type RepCandidate,
} from "../components/sport-admin-list";

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
    .select("id, name, is_active, rep_id")
    .order("name");

  const mine = (sports ?? []).filter((s) => s.rep_id === profile.id);

  // Reps have to be real accounts; inactive ones are hidden so a leaver
  // cannot be appointed.
  const { data: people } = isAdmin
    ? await db
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_active", true)
        .order("full_name")
    : { data: [] };

  const candidates: RepCandidate[] = (people ?? []).map((p) => ({
    id: p.id,
    label: p.full_name || p.email,
  }));
  const rows: AdminSport[] = (sports ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    isActive: s.is_active,
    repId: s.rep_id,
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
              results. Appointing a rep also gives that person the sport-rep role; they then
              edit practice times, fixtures and results on the sport&apos;s own page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SportAdminList sports={rows} people={candidates} />
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
