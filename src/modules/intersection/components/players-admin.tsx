"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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
import { createPlayer, deletePlayer } from "../actions";
import type { SectionOption } from "./match-admin";

export interface AdminPlayer {
  id: string;
  name: string;
  sectionId: string;
  linked: boolean;
}

// The player list the rosters draw from. A player is ideally a linked account
// (their profile name follows them), with a free-text name for people who
// never signed up.
export function PlayersAdmin({
  players,
  sections,
  accounts,
}: {
  players: AdminPlayer[];
  sections: SectionOption[];
  accounts: Array<{ id: string; label: string; sectionId: string | null }>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const router = useRouter();

  const sectionItems = sections.map((s) => ({ value: s.id, label: s.name }));
  const accountItems = [
    { value: "", label: "Not linked to an account" },
    ...accounts.map((a) => ({ value: a.id, label: a.label })),
  ];

  async function add(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await createPlayer(formData);
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    const result = await deletePlayer(id);
    setBusy(false);
    setConfirmId(null);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <div className="space-y-4">
      <form action={add} className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1">
          <Label htmlFor="player-name">Name</Label>
          <Input id="player-name" name="name" placeholder="Jaco Steyn" className="h-11" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="player-section">Section</Label>
          <Select name="sectionId" items={sectionItems} required>
            <SelectTrigger id="player-section" className="h-11 w-40">
              <SelectValue placeholder="Section" />
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
        <div className="space-y-1">
          <Label htmlFor="player-account">Account (optional)</Label>
          <Select name="profileId" defaultValue="" items={accountItems}>
            <SelectTrigger id="player-account" className="h-11 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accountItems.map((item) => (
                <SelectItem key={item.value} value={item.value} className="h-9">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" size="lg" className="h-11" disabled={busy}>
          <Plus aria-hidden />
          Add player
        </Button>
      </form>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="space-y-3">
        {sections.map((section) => {
          const sectionPlayers = players.filter((p) => p.sectionId === section.id);
          if (sectionPlayers.length === 0) return null;
          return (
            <div key={section.id} className="space-y-1">
              <p className="text-sm font-medium">{section.name}</p>
              <ul className="divide-y">
                {sectionPlayers.map((player) => (
                  <li key={player.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="flex-1">
                      {player.name}
                      {player.linked && (
                        <span className="text-muted-foreground text-xs"> · linked account</span>
                      )}
                    </span>
                    {confirmId === player.id ? (
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-11 sm:h-8"
                          disabled={busy}
                          onClick={() => remove(player.id)}
                        >
                          Really remove
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-11 sm:h-8"
                          onClick={() => setConfirmId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        aria-label={`Remove ${player.name}`}
                        onClick={() => setConfirmId(player.id)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
