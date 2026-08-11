"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateQuietHours } from "../actions";

// Quiet hours defer delivery; they never hide anything. The bell always shows
// everything the moment it happens — see docs/DECISIONS.md ("Notifications
// always persist; quiet hours defer delivery only"). Urgent ignores them.
export function QuietHoursForm({ start, end }: { start: string; end: string }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await updateQuietHours(formData);
    setBusy(false);
    if (result.ok) setSaved(true);
    else setError(result.error);
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="quiet-start">From</Label>
          <Input
            id="quiet-start"
            name="start"
            type="time"
            defaultValue={start}
            className="h-11 w-32"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quiet-end">Until</Label>
          <Input
            id="quiet-end"
            name="end"
            type="time"
            defaultValue={end}
            className="h-11 w-32"
            required
          />
        </div>
        <Button type="submit" variant="outline" size="lg" className="h-11" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Urgent announcements ignore this. Everything else waits until the morning.
      </p>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && <p className="text-muted-foreground text-sm">Saved.</p>}
    </form>
  );
}
