"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/core/ui/date-time-picker";
import { saveEvent } from "../actions";

export function EventForm({
  values,
  scoreNeededCount = 0,
}: {
  values: {
    id?: string;
    name: string;
    startDate: string;
    rules: string;
    allowDraws: boolean;
    scoreDiff: boolean;
  };
  /** Results saved before score difference was switched on, still without scores. */
  scoreNeededCount?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(values.startDate);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    setSaved(false);
    // Creating redirects to the new event's admin page and never returns.
    const result = await saveEvent(formData);
    setBusy(false);
    if (result?.ok) setSaved(true);
    else if (result) setError(result.error);
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="space-y-1">
        <Label htmlFor="name">Event</Label>
        <Input
          id="name"
          name="name"
          defaultValue={values.name}
          placeholder="Touch Rugby Day"
          className="h-11"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="startDate">Date</Label>
        {/* The picker is the control; the hidden input is what the form
            actually submits, so saveEvent still reads a plain "2026-09-01". */}
        <input type="hidden" name="startDate" value={startDate} />
        <DateTimePicker
          id="startDate"
          label="When is the event?"
          mode="date"
          value={startDate}
          onChange={setStartDate}
          className="w-full sm:w-72"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="rules">Rules</Label>
        <Textarea
          id="rules"
          name="rules"
          defaultValue={values.rules}
          rows={4}
          placeholder="Seven a side, two five-minute halves. Win = 3 points, head-to-head breaks ties."
        />
      </div>
      {/* UNCONTROLLED on purpose, with defaultChecked from the saved event.
          React resets a form to its defaults after a form action. A
          controlled box kept its own state while the DOM was reset under
          it, so it showed unticked right after a successful save — the same
          "will not stay ticked" bug the old app had. Uncontrolled, the reset
          lands on the value the server just saved (or kept, if the save was
          refused), which is the truth either way. */}
      <fieldset className="space-y-1">
        <legend className="sr-only">Scoring</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="allowDraws"
            defaultChecked={values.allowDraws}
            className="accent-primary size-4 shrink-0"
          />
          Group fixtures can end in a draw (1 point each)
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="scoreDiff"
            defaultChecked={values.scoreDiff}
            className="accent-primary size-4 shrink-0"
          />
          Enable score difference
        </label>
        {values.scoreDiff && scoreNeededCount > 0 && (
          <p className="text-muted-foreground pl-6 text-sm">
            {scoreNeededCount === 1
              ? "1 result from before this was on needs a score. Until then it counts for nothing in the difference."
              : `${scoreNeededCount} results from before this was on need a score. Until then they count for nothing in the difference.`}
          </p>
        )}
      </fieldset>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && <p className="text-muted-foreground text-sm">Saved.</p>}
      <Button type="submit" size="lg" className="h-11" disabled={busy}>
        {busy ? "Saving…" : values.id ? "Save event" : "Create event"}
      </Button>
    </form>
  );
}
