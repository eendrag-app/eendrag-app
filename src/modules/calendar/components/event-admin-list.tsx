"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eventCategoryColor, eventCategoryLabel } from "@/core/ui/event-categories";
import { ColorDot } from "@/core/ui/section-badge";
import { deleteEvent } from "../actions";

export interface AdminEvent {
  id: string;
  title: string;
  category: string;
  whenLabel: string;
  location: string;
  sectionName: string | null;
  sourceModule: string | null;
}

export function EventAdminList({ items }: { items: AdminEvent[] }) {
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    const result = await deleteEvent(id);
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
              <Badge variant="outline">
                <ColorDot color={eventCategoryColor(item.category)} />
                {item.sectionName ?? eventCategoryLabel(item.category)}
              </Badge>
              {item.sourceModule && (
                <Badge variant="ghost" className="text-muted-foreground">
                  <Lock aria-hidden />
                  From the {item.sourceModule} module
                </Badge>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-muted-foreground text-sm">
                {item.whenLabel}
                {item.location ? ` · ${item.location}` : ""}
              </p>
            </div>
            {item.sourceModule ? (
              <p className="text-muted-foreground text-sm">
                Added automatically when the fixture was posted. Change the fixture and this
                follows.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 sm:h-8"
                  nativeButton={false}
                  render={<Link href={`/calendar/admin/${item.id}`} />}
                >
                  <Pencil aria-hidden />
                  Edit
                </Button>
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
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
