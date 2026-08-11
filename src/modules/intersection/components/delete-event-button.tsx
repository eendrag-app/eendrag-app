"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteEvent } from "../actions";

export function DeleteEventButton({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    // On success this redirects to the admin list and never returns.
    const result = await deleteEvent(eventId);
    setBusy(false);
    if (result && !result.ok) setError(result.error);
  }

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="lg"
        className="text-muted-foreground h-11"
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden />
        Delete this event
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm">
        Delete {eventName}? Its groups, fixtures, results and roster go with it, and the
        leaderboard is recalculated without it. There is no undo.
      </p>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button variant="destructive" className="h-11" disabled={busy} onClick={remove}>
          {busy ? "Deleting…" : "Yes, delete it"}
        </Button>
        <Button variant="ghost" className="h-11" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
