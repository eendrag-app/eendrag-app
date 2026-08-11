"use client";

import { useState, useTransition } from "react";
import { Clock, Pencil, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorDot } from "@/core/ui/section-badge";
import { clearResult, setMatchTeams, setMatchTime, setResult } from "../actions";

export interface AdminMatch {
  id: string;
  label: string;
  teamAId: string | null;
  teamBId: string | null;
  teamALabel: string;
  teamBLabel: string;
  winnerId: string | null;
  note: string;
  scheduledInput: string;
  played: boolean;
  manual: boolean;
  canEditTeams: boolean;
  clearBlockedReason: string | null;
}

export interface SectionOption {
  id: string;
  name: string;
  color: string;
}

// Entering results, setting times, and the two overrides the old app had:
// clearing a result (guarded) and editing a knockout pairing by hand.
export function MatchAdmin({
  matches,
  sections,
}: {
  matches: AdminMatch[];
  sections: SectionOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingTeams, setEditingTeams] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const sectionItems = sections.map((s) => ({ value: s.id, label: s.name }));

  // Dispatched inside a transition so React applies the fresh server render
  // the action sends back (refresh() in ../actions.ts) without a second round
  // trip, and keeps the rest of the page usable while it lands. It matters
  // here more than elsewhere: nearly everything on this screen — which results
  // can still be cleared, whether the draw can be redone — is recomputed by
  // the server from the guards after every write.
  function run(id: string, work: () => Promise<{ ok: boolean; error?: string }>) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const result = await work();
      setBusyId(null);
      if (result.ok) setEditingTeams(null);
      else setError(result.error ?? "That did not work");
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-destructive text-sm">{error}</p>}
      <ul className="divide-y">
        {matches.map((match) => {
          const note = notes[match.id] ?? match.note;
          return (
            <li key={match.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{match.label}</Badge>
                {match.manual && <Badge variant="ghost">Pairing set by hand</Badge>}
                {match.played && <Badge variant="secondary">Played</Badge>}
              </div>

              <p className="text-sm">
                {match.teamALabel} <span className="text-muted-foreground">v</span>{" "}
                {match.teamBLabel}
              </p>

              {/* Winner + score note */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`winner-${match.id}`} className="text-xs">
                    Winner
                  </Label>
                  <Select
                    value={match.winnerId ?? ""}
                    items={[match.teamAId, match.teamBId]
                      .filter((id): id is string => Boolean(id))
                      .map((id) => ({
                        value: id,
                        label: sections.find((s) => s.id === id)?.name ?? "Unknown",
                      }))}
                    disabled={!match.teamAId || !match.teamBId}
                    onValueChange={(value) =>
                      run(match.id, () => setResult(match.id, String(value), note))
                    }
                  >
                    <SelectTrigger
                      id={`winner-${match.id}`}
                      className="h-11 w-44"
                      aria-label={`Winner of ${match.label}`}
                    >
                      <SelectValue placeholder="Nobody yet" />
                    </SelectTrigger>
                    <SelectContent>
                      {[match.teamAId, match.teamBId]
                        .filter((id): id is string => Boolean(id))
                        .map((id) => (
                          <SelectItem key={id} value={id} className="h-9">
                            <ColorDot color={sections.find((s) => s.id === id)?.color} />
                            {sections.find((s) => s.id === id)?.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`note-${match.id}`} className="text-xs">
                    Score note
                  </Label>
                  <Input
                    id={`note-${match.id}`}
                    value={note}
                    placeholder="21–14"
                    className="h-11 w-32"
                    onChange={(e) => setNotes((prev) => ({ ...prev, [match.id]: e.target.value }))}
                    onBlur={() => {
                      if (match.played && match.winnerId && note !== match.note) {
                        void run(match.id, () => setResult(match.id, match.winnerId!, note));
                      }
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`time-${match.id}`} className="text-xs">
                    <Clock className="mr-1 inline size-3" aria-hidden />
                    Time
                  </Label>
                  <Input
                    id={`time-${match.id}`}
                    type="datetime-local"
                    defaultValue={match.scheduledInput}
                    className="h-11"
                    onChange={(e) => run(match.id, () => setMatchTime(match.id, e.target.value))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {match.played && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-11 sm:h-8"
                    disabled={busyId === match.id || Boolean(match.clearBlockedReason)}
                    title={match.clearBlockedReason ?? undefined}
                    onClick={() => run(match.id, () => clearResult(match.id))}
                  >
                    <RotateCcw aria-hidden />
                    Clear result
                  </Button>
                )}
                {match.canEditTeams && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-11 sm:h-8"
                    onClick={() =>
                      setEditingTeams(editingTeams === match.id ? null : match.id)
                    }
                  >
                    <Pencil aria-hidden />
                    Edit teams
                  </Button>
                )}
              </div>

              {match.clearBlockedReason && match.played && (
                <p className="text-muted-foreground text-sm">{match.clearBlockedReason}</p>
              )}

              {editingTeams === match.id && (
                <form
                  action={(formData) =>
                    run(match.id, () =>
                      setMatchTeams(
                        match.id,
                        String(formData.get("teamA") ?? ""),
                        String(formData.get("teamB") ?? ""),
                      ),
                    )
                  }
                  className="bg-muted/40 flex flex-wrap items-end gap-2 rounded-lg p-3"
                >
                  <div className="space-y-1">
                    <Label htmlFor={`teamA-${match.id}`} className="text-xs">
                      Team A
                    </Label>
                    <Select name="teamA" defaultValue={match.teamAId ?? undefined} items={sectionItems}>
                      <SelectTrigger id={`teamA-${match.id}`} className="h-11 w-44">
                        <SelectValue placeholder="Pick a section" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectionItems.map((item) => (
                          <SelectItem key={item.value} value={item.value} className="h-9">
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`teamB-${match.id}`} className="text-xs">
                      Team B
                    </Label>
                    <Select name="teamB" defaultValue={match.teamBId ?? undefined} items={sectionItems}>
                      <SelectTrigger id={`teamB-${match.id}`} className="h-11 w-44">
                        <SelectValue placeholder="Pick a section" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectionItems.map((item) => (
                          <SelectItem key={item.value} value={item.value} className="h-9">
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" size="lg" className="h-11" disabled={busyId === match.id}>
                    Save pairing
                  </Button>
                  <p className="text-muted-foreground w-full text-sm">
                    Setting a pairing by hand stops the bracket from filling this match in
                    automatically — use it for a three-way tie the standings cannot split.
                  </p>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
