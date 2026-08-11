"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Send, Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionBadge } from "@/core/ui/section-badge";
import { deleteAnnouncement, publishAnnouncement } from "../actions";

export interface AdminAnnouncement {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  whenLabel: string;
  isUrgent: boolean;
  sectionName: string | null;
  sectionColor: string | null;
  readCount: number | null;
}

// The list HK works from. Open counts are numbers and only numbers: the
// database has no policy that would let anyone read who opened a post, on
// purpose (migration 0300).
export function AnnouncementAdminList({ items }: { items: AdminAnnouncement[] }) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const router = useRouter();

  async function publish(id: string) {
    setBusyId(id);
    setError(null);
    const result = await publishAnnouncement(id);
    setBusyId(null);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    const result = await deleteAnnouncement(id);
    setBusyId(null);
    setConfirmId(null);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-destructive text-sm">{error}</p>}
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.id} className="space-y-2 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={item.status === "published" ? "secondary" : "outline"}>
                {item.statusLabel}
              </Badge>
              {item.isUrgent && (
                <Badge variant="destructive">
                  <TriangleAlert aria-hidden />
                  Urgent
                </Badge>
              )}
              {item.sectionName && (
                <SectionBadge name={item.sectionName} color={item.sectionColor} />
              )}
              {item.readCount !== null && (
                <span className="text-muted-foreground ml-auto inline-flex items-center gap-1 text-sm">
                  <Eye className="size-4" aria-hidden />
                  {item.readCount} opened
                </span>
              )}
            </div>

            <div>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-muted-foreground text-sm">{item.whenLabel}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-11 sm:h-8"
                nativeButton={false}
                render={<Link href={`/admin/announcements/${item.id}`} />}
              >
                <Pencil aria-hidden />
                Edit
              </Button>
              {item.status !== "published" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 sm:h-8"
                  disabled={busyId === item.id}
                  onClick={() => publish(item.id)}
                >
                  <Send aria-hidden />
                  Publish now
                </Button>
              )}
              {confirmId === item.id ? (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-11 sm:h-8"
                    disabled={busyId === item.id}
                    onClick={() => remove(item.id)}
                  >
                    Really delete
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11 sm:h-8"
                    onClick={() => setConfirmId(null)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-11 sm:h-8"
                  onClick={() => setConfirmId(item.id)}
                >
                  <Trash2 aria-hidden />
                  Delete
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
