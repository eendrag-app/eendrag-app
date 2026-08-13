import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole, type Role } from "@/core/permissions";
import { allAdminPanels } from "@/modules/registry";

export const metadata = { title: "Admin" };

// Every admin surface in the app, in one place, built from the registry. A
// module that declares an adminPanel appears here for free; nothing about any
// particular module is written down in this file.
export default async function AdminPage() {
  const profile = await requireRole("admin");
  const panels = allAdminPanels().filter((p) => p.roles.includes(profile.role as Role));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="text-muted-foreground -mt-2 text-sm">
        You see this tab because you are on the HK.
      </p>

      {panels.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Nothing to manage yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tools</CardTitle>
            <CardDescription>
              Everything you can change. What you actually may change is decided by the
              database, not by this list.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {panels.map((panel) => (
              <Link
                key={panel.id}
                href={panel.href}
                className="hover:bg-muted/60 -mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2"
              >
                <span className="flex-1">
                  <span className="block text-sm font-medium">{panel.title}</span>
                  <span className="text-muted-foreground block text-sm">
                    {panel.description}
                  </span>
                </span>
                <ChevronRight className="text-muted-foreground size-4" aria-hidden />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
