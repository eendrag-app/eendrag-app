"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toggleGoing } from "../actions";

export interface GoingPerson {
  id: string;
  name: string;
  sectionName?: string;
}

// "I'm going", with the count of everyone else who said so.
//
// The number is the point: pressing a button into silence tells you nothing,
// and whether a practice is worth walking to depends entirely on whether
// anyone else is coming. One row per person per sport, own-row only under RLS.
//
// Tapping the count opens the names. "Three going" answers a different
// question from "Jan, Pieter and Thabo are going", and on a phone the second
// one is what decides whether you put your shoes on.
//
// Both the button and the count move optimistically and roll back together if
// the write is refused — a count that disagrees with the button is worse than
// a slow one. The list moves with them, which is why `me` is passed in: your
// own name has to appear the moment you press the button, not a round trip
// later.
export function GoingButton({
  sportId,
  going,
  people,
  me,
}: {
  sportId: string;
  going: boolean;
  people: GoingPerson[];
  me: GoingPerson;
}) {
  const [on, setOn] = useState(going);
  const [list, setList] = useState(people);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const router = useRouter();

  const count = list.length;

  async function toggle() {
    setBusy(true);
    setError(null);
    const wasOn = on;
    setOn(!wasOn);
    setList((prev) =>
      wasOn ? prev.filter((p) => p.id !== me.id) : [...prev, me],
    );

    const result = await toggleGoing(sportId, wasOn);
    setBusy(false);
    if (!result.ok) {
      setOn(wasOn);
      setList(people);
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          variant={on ? "outline" : "default"}
          className="h-11 w-full sm:w-auto"
          disabled={busy}
          onClick={toggle}
        >
          {on && <Check aria-hidden />}
          {on ? "You're going — tap to cancel" : "I'm going"}
        </Button>
        {count === 0 ? (
          <p
            className="text-muted-foreground flex items-center gap-1.5 text-sm"
            aria-live="polite"
          >
            <Users className="size-4" aria-hidden />
            Nobody yet
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setListOpen(true)}
            // Spoken as one phrase, and announced when it changes: a screen
            // reader user gets the same feedback as the number ticking up.
            aria-live="polite"
            className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-sm underline-offset-4 hover:underline"
          >
            <Users className="size-4" aria-hidden />
            <span className="tabular-nums">{count}</span> going
          </button>
        )}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}

      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetContent side="bottom" className="mx-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              Going — {count} {count === 1 ? "person" : "people"}
            </SheetTitle>
          </SheetHeader>
          <ul className="max-h-[60vh] divide-y overflow-y-auto px-4 pb-6">
            {list.map((person) => (
              <li key={person.id} className="flex items-center gap-2 py-2.5 text-sm">
                <span className="flex-1">
                  {person.id === me.id ? "You" : person.name}
                </span>
                {person.sectionName && (
                  <span className="text-muted-foreground text-xs">{person.sectionName}</span>
                )}
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}
