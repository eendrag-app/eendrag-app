"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { regenerateCalendarToken } from "../actions";

// The personal ICS subscription link. Anyone holding the URL sees this user's
// calendar, so the only protection is that the token is secret — hence the
// regenerate button, which is the "I pasted it in the wrong group" undo.
export function CalendarFeed({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copying failed — select the link and copy it by hand.");
    }
  }

  async function regenerate() {
    setBusy(true);
    setError(null);
    const result = await regenerateCalendarToken();
    setBusy(false);
    setConfirming(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          readOnly
          value={url}
          aria-label="Your calendar feed address"
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 font-mono text-xs"
        />
        <Button type="button" variant="outline" size="lg" className="h-11" onClick={copy}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Add it in Google Calendar under <em>Other calendars → From URL</em>, or in Apple
        Calendar under <em>File → New Calendar Subscription</em>. Res events, your
        section&apos;s events, sport fixtures and intersection games all appear.
      </p>
      {confirming ? (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm">
            Make a new link? Any calendar you have already subscribed will stop updating
            and has to be re-added.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              onClick={regenerate}
              disabled={busy}
            >
              {busy ? "Working…" : "Yes, new link"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setConfirming(true)}
        >
          Regenerate link
        </Button>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
