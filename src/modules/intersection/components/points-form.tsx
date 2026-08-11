"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePoints } from "../actions";

const FIELDS = [
  { name: "champion", label: "Champion" },
  { name: "runnerUp", label: "Runner-up" },
  { name: "semis", label: "Lost the semi" },
  { name: "quarters", label: "Lost the quarter" },
  { name: "group", label: "Out in the groups" },
] as const;

export function PointsForm({
  values,
}: {
  values: { champion: number; runnerUp: number; semis: number; quarters: number; group: number };
}) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await savePoints(formData);
    setBusy(false);
    if (result.ok) setSaved(true);
    else setError(result.error);
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {FIELDS.map((field) => (
          <div key={field.name} className="space-y-1">
            <Label htmlFor={field.name} className="text-xs">
              {field.label}
            </Label>
            <Input
              id={field.name}
              name={field.name}
              type="number"
              min={0}
              defaultValue={values[field.name]}
              className="h-11 w-24"
            />
          </div>
        ))}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && <p className="text-muted-foreground text-sm">Saved.</p>}
      <Button type="submit" variant="outline" size="lg" className="h-11" disabled={busy}>
        {busy ? "Saving…" : "Save points"}
      </Button>
      <p className="text-muted-foreground text-sm">
        The whole leaderboard is recalculated from these, so changing them mid-season
        rewrites history. People will have opinions.
      </p>
    </form>
  );
}
