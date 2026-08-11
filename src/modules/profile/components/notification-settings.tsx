"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { categoryCopy } from "../lib/categories";
import { updateNotificationPreference } from "../actions";

// One switch per category the registry knows about. Saving happens on toggle
// (a settings list, not a form) and is optimistic — if the write fails the
// switch flips back and says so, which is the only honest way to show it.
export function NotificationSettings({
  categories,
  enabled,
}: {
  categories: string[];
  enabled: Record<string, boolean>;
}) {
  const [state, setState] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  async function toggle(category: string, next: boolean) {
    setState((prev) => ({ ...prev, [category]: next }));
    setError(null);
    const result = await updateNotificationPreference(category, next);
    if (!result.ok) {
      setState((prev) => ({ ...prev, [category]: !next }));
      setError(result.error);
    }
  }

  return (
    <div className="space-y-1">
      {categories.map((category) => {
        const copy = categoryCopy(category);
        const id = `notify-${category}`;
        return (
          <div key={category} className="flex min-h-11 items-start justify-between gap-4 py-2">
            <div className="space-y-0.5">
              <label htmlFor={id} className="text-sm font-medium">
                {copy.label}
              </label>
              {copy.description && (
                <p className="text-muted-foreground text-sm">{copy.description}</p>
              )}
            </div>
            <Switch
              id={id}
              className="mt-1"
              checked={state[category] ?? false}
              onCheckedChange={(next) => toggle(category, next)}
            />
          </div>
        );
      })}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
