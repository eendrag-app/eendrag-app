import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { requireRole } from "@/core/permissions";
import { SportAdminList, type AdminSport } from "../components/sport-admin-list";

export const metadata = { title: "Sports & reps" };

// Declared as this module's admin panel, so it appears on the Admin tab.
//
// ADMINS ONLY, on purpose. A rep runs their sport from the sport's own page —
// the same page the res reads — and has no business in the catalogue, where
// appointing reps and deleting sports live. Reps used to land here on a
// read-only variant of this screen, which was two ways to reach one job.
export default async function SportAdminPage() {
  await requireRole("admin");
  const db = await createClient();

  const { data: sports } = await db
    .from("sports")
    .select("id, name, rep_id, rep_name, rep_phone, rep_email")
    .order("name");

  const rows: AdminSport[] = (sports ?? []).map((s) => ({
    id: s.id,
    name: s.name,
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
        href="/admin"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Admin
      </Link>
      <h1 className="text-2xl font-semibold">Sports &amp; reps</h1>

      <Card>
        <CardHeader>
          <CardTitle>The catalogue</CardTitle>
          <CardDescription>
            Type the rep&apos;s name and number for the contact card; their student email is
            what lets them edit practice times, fixtures and results on the sport&apos;s own
            page. You can appoint someone before they have an account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SportAdminList sports={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
