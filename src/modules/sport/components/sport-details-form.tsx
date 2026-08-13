"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateSportDetails } from "../actions";

// The rep's edit of their own sport's page. RLS (sports_update_admin_or_own_rep)
// is what allows it; this form is only ever rendered for someone who passes.
export function SportDetailsForm({
  sportId,
  practiceInfo,
  venue,
  coach,
  description,
}: {
  sportId: string;
  practiceInfo: string;
  venue: string;
  coach: string;
  description: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await updateSportDetails(formData);
    setBusy(false);
    if (result.ok) setSaved(true);
    else setError(result.error);
  }

  return (
    // Keyed on the values so that a re-render after saving (or after someone
    // else's change) remounts the inputs with the new defaults instead of
    // Base UI warning that an uncontrolled field's default moved under it.
    <form
      key={`${practiceInfo}|${venue}|${coach}|${description}`}
      action={onSubmit}
      className="space-y-4"
    >
      <input type="hidden" name="sportId" value={sportId} />

      <div className="space-y-1">
        <Label htmlFor="practiceInfo">Next practice</Label>
        <Input
          id="practiceInfo"
          name="practiceInfo"
          defaultValue={practiceInfo}
          placeholder="Tue &amp; Thu 18:30–20:00"
          className="h-11"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="venue">Venue</Label>
        <Input
          id="venue"
          name="venue"
          defaultValue={venue}
          placeholder="Coetzenburg B-field"
          className="h-11"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="coach">Coach (optional)</Label>
        <Input id="coach" name="coach" defaultValue={coach} className="h-11" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Details</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={description}
          rows={4}
          placeholder="Beginners welcome, sticks to borrow, bring takkies."
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && <p className="text-muted-foreground text-sm">Saved.</p>}
      <Button type="submit" size="lg" className="h-11" disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </Button>
      <p className="text-muted-foreground text-sm">
        Changing the practice time or the venue notifies everyone who plays this sport —
        once, not once per field.
      </p>
    </form>
  );
}
