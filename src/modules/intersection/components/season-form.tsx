"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startNewSeason } from "../actions";

/**
 * The once-a-year reset: end this season, start the next one.
 *
 * Two deliberate speed bumps, and no more than two. The panel is closed until
 * you open it, and ending a season means typing its name. There is no
 * multi-admin approval because nothing here is destroyed — every event and
 * result stays readable under the season it belonged to — so the worst a
 * misclick costs is starting the next season a few minutes early.
 */
export function SeasonForm({ currentName }: { currentName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await startNewSeason(formData);
    setBusy(false);
    if (result.ok) {
      setDone(true);
      setOpen(false);
    } else {
      setError(result.error);
    }
  }

  if (done) {
    return (
      <p className="text-sm">
        New season started. {currentName} is now under Past seasons with everything that
        happened in it.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <Button variant="outline" size="lg" className="h-11" onClick={() => setOpen(true)}>
          <CalendarRange aria-hidden />
          Start a new season
        </Button>
        <p className="text-muted-foreground text-sm">
          Do this once a year, when the competition starts again. Nothing is deleted:{" "}
          {currentName} and all its results move to Past seasons, and the new season starts
          with every section on zero.
        </p>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="season-name" className="text-xs">
          Name of the new season
        </Label>
        <Input
          id="season-name"
          name="name"
          required
          maxLength={60}
          placeholder={String(Number(currentName) + 1 || "")}
          className="h-11 w-40"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="season-confirm" className="text-xs">
          Type <span className="font-semibold">{currentName}</span> to confirm you are ending
          that season
        </Label>
        <Input
          id="season-confirm"
          name="confirm"
          required
          autoComplete="off"
          className="h-11 w-40"
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="h-11" disabled={busy}>
          {busy ? "Starting…" : "End season and start the next"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="h-11"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Reversible: if this was a mistake, start a season again and name it {currentName} —
        the events you just archived are untouched.
      </p>
    </form>
  );
}
