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
import { onboardingAction } from "./actions";

interface Option {
  id: string;
  name: string;
}

export function OnboardingForm({
  sections,
  sports,
}: {
  sections: Option[];
  sports: Option[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await onboardingAction(formData);
    if (result && !result.ok) {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="sectionId">Section</Label>
        <Select name="sectionId" required>
          <SelectTrigger id="sectionId" className="w-full">
            <SelectValue placeholder="Choose your section" />
          </SelectTrigger>
          <SelectContent>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="roomNumber">Room number</Label>
        <Input id="roomNumber" name="roomNumber" placeholder="e.g. 214" />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Sports you play <span className="text-muted-foreground">(optional)</span>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {sports.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="sportIds"
                value={s.id}
                className="accent-primary size-4"
              />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Saving…" : "Done"}
      </Button>
    </form>
  );
}
