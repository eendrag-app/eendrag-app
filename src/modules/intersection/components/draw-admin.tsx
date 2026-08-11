"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateDrawAction, swapGroupTeam } from "../actions";
import type { SectionOption } from "./match-admin";

export interface AdminGroup {
  id: string;
  name: string;
  sectionIds: string[];
}

// Generate the draw, and move teams between groups until the games start.
// The shuffle and the fixture pattern come from lib/tournament.ts — this is
// only the screen.
export function DrawAdmin({
  eventId,
  groups,
  sections,
  canRegenerate,
  regenerateBlockedReason,
  canEditGroups,
  editBlockedReason,
}: {
  eventId: string;
  groups: AdminGroup[];
  sections: SectionOption[];
  canRegenerate: boolean;
  regenerateBlockedReason: string | null;
  canEditGroups: boolean;
  editBlockedReason: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const items = sections.map((s) => ({ value: s.id, label: s.name }));

  async function generate() {
    setBusy(true);
    setError(null);
    const result = await generateDrawAction(eventId);
    setBusy(false);
    setConfirming(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  async function swap(groupId: string, slot: number, sectionId: string) {
    setBusy(true);
    setError(null);
    const result = await swapGroupTeam(eventId, groupId, slot, sectionId);
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-2">
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button size="lg" className="h-11" disabled={busy} onClick={generate}>
          <Shuffle aria-hidden />
          {busy ? "Drawing…" : "Generate the draw"}
        </Button>
        <p className="text-muted-foreground text-sm">
          Four random groups of three, then the whole fixture list: group games, four
          quarter-finals, two semis and a final.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.id} className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Group {group.name}</p>
            {group.sectionIds.map((sectionId, slot) => (
              <Select
                key={`${group.id}-${slot}`}
                value={sectionId}
                items={items}
                disabled={!canEditGroups || busy}
                onValueChange={(value) => swap(group.id, slot, String(value))}
              >
                <SelectTrigger
                  className="h-11 w-full"
                  aria-label={`Group ${group.name}, team ${slot + 1}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item.value} className="h-9">
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
        ))}
      </div>

      {!canEditGroups && editBlockedReason && (
        <p className="text-muted-foreground text-sm">{editBlockedReason}</p>
      )}

      {canRegenerate ? (
        confirming ? (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm">
              Draw it again? The current groups and every fixture are thrown away, including
              any times you have set.
            </p>
            <div className="flex gap-2">
              <Button variant="destructive" className="h-11" disabled={busy} onClick={generate}>
                Yes, redraw
              </Button>
              <Button variant="ghost" className="h-11" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="lg" className="h-11" onClick={() => setConfirming(true)}>
            <Shuffle aria-hidden />
            Draw again
          </Button>
        )
      ) : (
        regenerateBlockedReason && (
          <p className="text-muted-foreground text-sm">{regenerateBlockedReason}</p>
        )
      )}
    </div>
  );
}
