"use client";

import { useState } from "react";
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
import { updateDetails } from "../actions";

interface Option {
  id: string;
  name: string;
}

// The same four fields as onboarding, editable forever after. Kept as one
// form with one Save so it behaves like a form and not like a settings panel
// that saves behind your back.
export function DetailsForm({
  fullName,
  sectionId,
  roomNumber,
  sections,
  sports,
  playedSportIds,
}: {
  fullName: string;
  sectionId: string | null;
  roomNumber: string;
  sections: Option[];
  sports: Option[];
  playedSportIds: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await updateDetails(formData);
    setBusy(false);
    if (result.ok) setSaved(true);
    else setError(result.error);
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          autoComplete="name"
          className="h-11"
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="sectionId">Section</Label>
        <Select
          name="sectionId"
          defaultValue={sectionId ?? undefined}
          // `items` is what makes the trigger show "Ingang" instead of the
          // section's uuid (Base UI Select.Value).
          items={sections.map((s) => ({ value: s.id, label: s.name }))}
          required
        >
          <SelectTrigger id="sectionId" className="h-11 w-full">
            <SelectValue placeholder="Choose your section" />
          </SelectTrigger>
          <SelectContent>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id} className="h-9">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="roomNumber">Room number</Label>
        <Input
          id="roomNumber"
          name="roomNumber"
          defaultValue={roomNumber}
          placeholder="e.g. 214"
          className="h-11"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Sports you play{" "}
          <span className="text-muted-foreground font-normal">
            — we only notify you about these
          </span>
        </legend>
        <div className="grid grid-cols-2 gap-1">
          {sports.map((s) => (
            <label key={s.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="sportIds"
                value={s.id}
                defaultChecked={playedSportIds.includes(s.id)}
                className="accent-primary size-4"
              />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && <p className="text-muted-foreground text-sm">Saved.</p>}
      <Button type="submit" size="lg" className="h-11 w-full sm:w-auto" disabled={busy}>
        {busy ? "Saving…" : "Save details"}
      </Button>
    </form>
  );
}
