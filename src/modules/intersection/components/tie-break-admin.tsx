"use client";

import { useState, useTransition } from "react";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setGroupTieBreak } from "../actions";
import { formatDiff } from "../lib/copy";

export interface TiedGroup {
  id: string;
  name: string;
  /** The three sections in table order, with what the table ranked them on. */
  teams: Array<{ id: string; name: string; points: number; diff: number }>;
  firstSectionId: string | null;
  secondSectionId: string | null;
}

// Who goes through when a group ends level.
//
// Either all three finished level, or two did after drawing each other — and,
// on a score difference event, they are level on difference and scores for
// too. Nothing left in the results separates them. The res settles it on the
// day; this is where the answer gets typed in. Until it is, both of that
// group's quarter-final slots stay empty rather than being filled by an
// arbitrary sort.
export function TieBreakAdmin({
  eventId,
  groups,
  scoreDiff,
}: {
  eventId: string;
  groups: TiedGroup[];
  scoreDiff: boolean;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <TieBreakRow key={group.id} eventId={eventId} group={group} scoreDiff={scoreDiff} />
      ))}
    </div>
  );
}

function TieBreakRow({
  eventId,
  group,
  scoreDiff,
}: {
  eventId: string;
  group: TiedGroup;
  scoreDiff: boolean;
}) {
  const [first, setFirst] = useState(group.firstSectionId ?? "");
  const [second, setSecond] = useState(group.secondSectionId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const items = group.teams.map((t) => ({ value: t.id, label: t.name }));
  const decided = Boolean(group.firstSectionId && group.secondSectionId);

  function save(nextFirst: string, nextSecond: string) {
    setError(null);
    startTransition(async () => {
      const result = await setGroupTieBreak(eventId, group.id, nextFirst, nextSecond);
      if (!result.ok) {
        setError(result.error);
        setFirst(group.firstSectionId ?? "");
        setSecond(group.secondSectionId ?? "");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Scale className="text-muted-foreground size-4" aria-hidden />
        <p className="text-sm font-medium">Group {group.name} finished level</p>
      </div>
      <ul className="text-sm">
        {group.teams.map((t) => (
          <li key={t.id} className="flex justify-between gap-3 py-0.5">
            <span className="truncate">{t.name}</span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {t.points} pts
              {scoreDiff && <> · {formatDiff(t.diff)}</>}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-sm">
        Nothing in the results separates the level sections, so the HK decides who goes
        through. Until you do, group {group.name}&apos;s two knockout places stay empty.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`first-${group.id}`} className="text-xs">
            Through as {group.name}1
          </Label>
          <Select
            value={first}
            items={items}
            onValueChange={(value) => {
              const picked = String(value);
              setFirst(picked);
              if (second && picked !== second) save(picked, second);
            }}
          >
            <SelectTrigger id={`first-${group.id}`} className="h-11 w-44">
              <SelectValue placeholder="Pick a section" />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value} className="h-9">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`second-${group.id}`} className="text-xs">
            Through as {group.name}2
          </Label>
          <Select
            value={second}
            items={items}
            onValueChange={(value) => {
              const picked = String(value);
              setSecond(picked);
              if (first && picked !== first) save(first, picked);
            }}
          >
            <SelectTrigger id={`second-${group.id}`} className="h-11 w-44">
              <SelectValue placeholder="Pick a section" />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value} className="h-9">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {decided && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-11 sm:h-8"
            disabled={busy}
            onClick={() => {
              setFirst("");
              setSecond("");
              save("", "");
            }}
          >
            Undo
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {first !== "" && first === second && (
        <p className="text-destructive text-sm">Pick two different sections.</p>
      )}
    </div>
  );
}
