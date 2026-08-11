"use client";

import { useState } from "react";
import { toggleRoster } from "../actions";
import type { SectionOption } from "./match-admin";

export interface RosterPlayer {
  id: string;
  name: string;
  sectionId: string;
  onRoster: boolean;
}

// Who is playing in this event. Rosters are what player stats count from, so
// an empty roster means an event nobody gets credit for.
export function RosterAdmin({
  eventId,
  players,
  sections,
}: {
  eventId: string;
  players: RosterPlayer[];
  sections: SectionOption[];
}) {
  const [rows, setRows] = useState(players);
  const [error, setError] = useState<string | null>(null);

  async function toggle(player: RosterPlayer, on: boolean) {
    setRows((prev) => prev.map((p) => (p.id === player.id ? { ...p, onRoster: on } : p)));
    setError(null);
    const result = await toggleRoster(eventId, player.id, on);
    if (!result.ok) {
      setRows((prev) => prev.map((p) => (p.id === player.id ? player : p)));
      setError(result.error);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No players have been added yet — add them under Players on the intersection admin
        page, then tick who is in this event.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-destructive text-sm">{error}</p>}
      {sections.map((section) => {
        const sectionPlayers = rows.filter((p) => p.sectionId === section.id);
        if (sectionPlayers.length === 0) return null;
        return (
          <div key={section.id} className="space-y-1">
            <p className="text-sm font-medium">{section.name}</p>
            <div className="grid grid-cols-2 gap-1">
              {sectionPlayers.map((player) => (
                <label key={player.id} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={player.onRoster}
                    onChange={(e) => toggle(player, e.target.checked)}
                  />
                  {player.name}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
