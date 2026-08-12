"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleGoing } from "../actions";

// "I'm going", with the count of everyone else who said so.
//
// The number is the point: pressing a button into silence tells you nothing,
// and whether a practice is worth walking to depends entirely on whether
// anyone else is coming. One row per person per sport, own-row only under RLS.
//
// Both the button and the count move optimistically and roll back together if
// the write is refused — a count that disagrees with the button is worse than
// a slow one.
export function GoingButton({
  sportId,
  going,
  goingCount,
}: {
  sportId: string;
  going: boolean;
  goingCount: number;
}) {
  const [on, setOn] = useState(going);
  const [count, setCount] = useState(goingCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function toggle() {
    setBusy(true);
    setError(null);
    const wasOn = on;
    setOn(!wasOn);
    setCount((c) => (wasOn ? Math.max(0, c - 1) : c + 1));

    const result = await toggleGoing(sportId, wasOn);
    setBusy(false);
    if (!result.ok) {
      setOn(wasOn);
      setCount(goingCount);
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
        <p
          className="text-muted-foreground flex items-center gap-1.5 text-sm"
          // Spoken as one phrase, and announced when it changes: a screen
          // reader user gets the same feedback as the number ticking up.
          aria-live="polite"
        >
          <Users className="size-4" aria-hidden />
          {count === 0 ? (
            "Nobody yet"
          ) : (
            <>
              <span className="tabular-nums">{count}</span> going
            </>
          )}
        </p>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
