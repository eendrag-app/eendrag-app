import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { requireRole } from "@/core/permissions";
import { MembersList, type Member } from "../components/members-list";

export const metadata = { title: "Members" };

// Admin panel declared by this module's module.ts. requireRole is the polite
// door; the real gate is RLS — profiles_update_admin plus the trigger that
// rejects role/is_active changes from non-admins (migration 0100/0101).
export default async function MembersPage() {
  await requireRole("admin");
  const db = await createClient();

  const { data } = await db
    .from("profiles")
    .select("id, full_name, email, role, is_active, sections(name)")
    .order("full_name");

  const members: Member[] = (data ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    role: p.role,
    isActive: p.is_active,
    sectionName: p.sections?.name ?? null,
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
      <h1 className="text-2xl font-semibold">Members</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            {members.length} {members.length === 1 ? "account" : "accounts"}
          </CardTitle>
          <CardDescription>
            Changes save as you make them. Making someone a sport rep here gives them the
            role; which sport they run is set under Sports &amp; reps. Deactivating stops
            notifications and removes admin rights — use it at year end instead of
            deleting, so old announcements keep their author.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MembersList members={members} />
        </CardContent>
      </Card>
    </div>
  );
}
