"use client";

import { useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { eventCategoryLabel } from "@/core/ui/event-categories";
import { saveEvent } from "../actions";

export interface EventFormValues {
  id?: string;
  title: string;
  description: string;
  category: string;
  sectionId: string;
  location: string;
  startsAt: string; // datetime-local value
  endsAt: string;
}

// Admins pick from three categories only. Sport fixtures and intersection
// games write themselves onto the calendar from their own modules — adding
// them by hand would just duplicate them (docs/ADMIN-GUIDE.md says so too).
const CATEGORY_ITEMS = ["res_wide", "section", "social"].map((value) => ({
  value,
  label: eventCategoryLabel(value),
}));

export function EventForm({
  values,
  sections,
}: {
  values: EventFormValues;
  sections: Array<{ id: string; name: string }>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState(values.category);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectionItems = sections.map((s) => ({ value: s.id, label: s.name }));

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await saveEvent(formData);
    setBusy(false);
    if (result && !result.ok) setError(result.error);
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <div className="space-y-1">
        <Label htmlFor="title">What is it</Label>
        <Input
          id="title"
          name="title"
          defaultValue={values.title}
          placeholder="Huisvergadering"
          className="h-11"
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="category">Kind of event</Label>
        <Select
          name="category"
          value={category}
          onValueChange={(v) => setCategory(String(v))}
          items={CATEGORY_ITEMS}
        >
          <SelectTrigger id="category" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value} className="h-9">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {category === "section" && (
        <div className="space-y-1">
          <Label htmlFor="sectionId">Which section</Label>
          <Select name="sectionId" defaultValue={values.sectionId || undefined} items={sectionItems}>
            <SelectTrigger id="sectionId" className="h-11 w-full">
              <SelectValue placeholder="Choose a section" />
            </SelectTrigger>
            <SelectContent>
              {sectionItems.map((item) => (
                <SelectItem key={item.value} value={item.value} className="h-9">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="location">Where</Label>
        <Input
          id="location"
          name="location"
          defaultValue={values.location}
          placeholder="Eendrag saal"
          className="h-11"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label htmlFor="startsAt">Starts</Label>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={values.startsAt}
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="endsAt">Ends (optional)</Label>
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={values.endsAt}
            className="h-11"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Anything else (optional)</Label>
        <Textarea id="description" name="description" defaultValue={values.description} rows={4} />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" size="lg" className="h-11" disabled={busy}>
        {busy ? "Saving…" : values.id ? "Save changes" : "Add to the calendar"}
      </Button>
      <p className="text-muted-foreground text-sm">
        Everyone it applies to gets a calendar notification, and it appears in their phone
        calendar if they have subscribed to the feed.
      </p>
    </form>
  );
}
