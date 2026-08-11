"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveEvent } from "../actions";

export function EventForm({
  values,
}: {
  values: { id?: string; name: string; startDate: string; rules: string };
}) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <Input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={values.startDate}
          className="h-11 w-48"
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
      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && <p className="text-muted-foreground text-sm">Saved.</p>}
      <Button type="submit" size="lg" className="h-11" disabled={busy}>
        {busy ? "Saving…" : values.id ? "Save event" : "Create event"}
      </Button>
    </form>
  );
}
