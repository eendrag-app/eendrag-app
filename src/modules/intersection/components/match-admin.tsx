"use client";

import { useState, useTransition } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { DateTimePicker } from "@/core/ui/date-time-picker";
import { clearResult, setMatchTeams, setMatchTime, setResult } from "../actions";
import { scoreOutcome } from "../lib/tournament";

// The value the winner pick uses for a draw. Section ids are uuids, so this
// can never collide with one.
const DRAW = "draw";

export interface AdminMatch {
  id: string;
  label: string;
  teamAId: string | null;
  teamBId: string | null;
  teamALabel: string;
  teamBLabel: string;
  winnerId: string | null;
  draw: boolean;
  /** May this fixture end in a draw? A group game of an event that allows them. */
  canDraw: boolean;
  aScore: number | null;
  bScore: number | null;
  /** Played before score difference was switched on, and still has no scores. */
  scoreNeeded: boolean;
  note: string;
  scheduledInput: string;
  played: boolean;
  manual: boolean;
  canEditTeams: boolean;
  clearBlockedReason: string | null;
}

export interface SectionOption {
  id: string;
  name: string;
}

// Entering results, setting times, and the two overrides the old app had:
// clearing a result (guarded) and editing a knockout pairing by hand.
//
// Two ways to enter a result, set per event:
// - score difference OFF: pick the winner (or "Draw" where allowed) and,
//   optionally, a free-text score note. The pick saves at once.
// - score difference ON: a score for each team and nothing else. The app
//   works out the result from them (scoreOutcome, the same function the
//   server uses) and only asks who went through when the scores are level and
//   a draw is not possible.
export function MatchAdmin({
  matches,
  sections,
  scoreDiff,
}: {
  matches: AdminMatch[];
  sections: SectionOption[];
  scoreDiff: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingTeams, setEditingTeams] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Winners the admin has picked but the server has not confirmed yet. The
  // dropdown used to show whatever the last server render said, so choosing a
  // winner appeared to do nothing until the whole write — recalculated
  // bracket, notifications and all — came back. The pick shows immediately and
  // is dropped again if the write is refused.
  const [pending, setPending] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const sectionItems = sections.map((s) => ({ value: s.id, label: s.name }));

  // Dispatched inside a transition so React applies the fresh server render
  // the action sends back (refresh() in ../actions.ts) without a second round
  // trip, and keeps the rest of the page usable while it lands. It matters
  // here more than elsewhere: nearly everything on this screen — which results
  // can still be cleared, whether the draw can be redone — is recomputed by
  // the server from the guards after every write.
  function run(
    id: string,
    work: () => Promise<{ ok: boolean; error?: string }>,
    onFailure?: () => void,
  ) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const result = await work();
      setBusyId(null);
      if (result.ok) setEditingTeams(null);
      else {
        setError(result.error ?? "That did not work");
        onFailure?.();
      }
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-destructive text-sm">{error}</p>}
      <ul className="divide-y">
        {matches.map((match) => {
          const note = notes[match.id] ?? match.note;
          // What the winner pick shows: a section id, "draw", or nothing yet.
          const savedPick = match.draw ? DRAW : (match.winnerId ?? "");
          const pick = pending[match.id] ?? savedPick;
          const pickItems = [
            ...[match.teamAId, match.teamBId]
              .filter((id): id is string => Boolean(id))
              .map((id) => ({
                value: id,
                label: sections.find((s) => s.id === id)?.name ?? "Unknown",
              })),
            ...(match.canDraw ? [{ value: DRAW, label: "Draw" }] : []),
          ];
          // The saved pick as setResult wants it, for re-saving the note alone.
          const savedEntry = match.draw
            ? { draw: true }
            : { winnerSectionId: match.winnerId ?? "" };
          return (
            <li key={match.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{match.label}</Badge>
                {match.manual && <Badge variant="ghost">Pairing set by hand</Badge>}
                {match.played && <Badge variant="secondary">Played</Badge>}
                {scoreDiff && match.scoreNeeded && (
                  <Badge variant="destructive">Score needed</Badge>
                )}
              </div>

              <ResultSummary match={match} />

              <div className="flex flex-wrap items-end gap-2">
                {scoreDiff ? (
                  <ScoreEntry
                    // Remount when the saved result changes (cleared, or
                    // saved elsewhere) so the boxes show what is stored.
                    key={`${match.played}-${match.aScore}-${match.bScore}-${match.winnerId}`}
                    match={match}
                    busy={busyId === match.id}
                    onSave={(entry) => run(match.id, () => setResult(match.id, entry))}
                  />
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor={`winner-${match.id}`} className="text-xs">
                        {match.canDraw ? "Result" : "Winner"}
                      </Label>
                      <Select
                        value={pick}
                        items={pickItems}
                        disabled={!match.teamAId || !match.teamBId}
                        onValueChange={(value) => {
                          const picked = String(value);
                          setPending((prev) => ({ ...prev, [match.id]: picked }));
                          const entry =
                            picked === DRAW
                              ? { draw: true, note }
                              : { winnerSectionId: picked, note };
                          run(
                            match.id,
                            () => setResult(match.id, entry),
                            () =>
                              setPending((prev) => {
                                const next = { ...prev };
                                delete next[match.id];
                                return next;
                              }),
                          );
                        }}
                      >
                        <SelectTrigger
                          id={`winner-${match.id}`}
                          className="h-11 w-44"
                          aria-label={`Result of ${match.label}`}
                        >
                          <SelectValue placeholder="Nobody yet" />
                        </SelectTrigger>
                        <SelectContent>
                          {pickItems.map((item) => (
                            <SelectItem key={item.value} value={item.value} className="h-9">
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`note-${match.id}`} className="text-xs">
                        Score note
                      </Label>
                      <Input
                        id={`note-${match.id}`}
                        value={note}
                        placeholder="21–14"
                        className="h-11 w-32"
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [match.id]: e.target.value }))
                        }
                        onBlur={() => {
                          if (match.played && note !== match.note) {
                            void run(match.id, () =>
                              setResult(match.id, { ...savedEntry, note }),
                            );
                          }
                        }}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <Label htmlFor={`time-${match.id}`} className="text-xs">
                    When
                  </Label>
                  <DateTimePicker
                    id={`time-${match.id}`}
                    label={`When is ${match.label}?`}
                    value={match.scheduledInput}
                    onChange={(next) => run(match.id, () => setMatchTime(match.id, next))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {match.played && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-11 sm:h-8"
                    disabled={busyId === match.id || Boolean(match.clearBlockedReason)}
                    title={match.clearBlockedReason ?? undefined}
                    onClick={() => run(match.id, () => clearResult(match.id))}
                  >
                    <RotateCcw aria-hidden />
                    Clear result
                  </Button>
                )}
                {match.canEditTeams && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-11 sm:h-8"
                    onClick={() =>
                      setEditingTeams(editingTeams === match.id ? null : match.id)
                    }
                  >
                    <Pencil aria-hidden />
                    Edit teams
                  </Button>
                )}
              </div>

              {match.clearBlockedReason && match.played && (
                <p className="text-muted-foreground text-sm">{match.clearBlockedReason}</p>
              )}

              {editingTeams === match.id && (
                <form
                  action={(formData) =>
                    run(match.id, () =>
                      setMatchTeams(
                        match.id,
                        String(formData.get("teamA") ?? ""),
                        String(formData.get("teamB") ?? ""),
                      ),
                    )
                  }
                  className="bg-muted/40 flex flex-wrap items-end gap-2 rounded-lg p-3"
                >
                  <div className="space-y-1">
                    <Label htmlFor={`teamA-${match.id}`} className="text-xs">
                      Team A
                    </Label>
                    <Select name="teamA" defaultValue={match.teamAId ?? undefined} items={sectionItems}>
                      <SelectTrigger id={`teamA-${match.id}`} className="h-11 w-44">
                        <SelectValue placeholder="Pick a section" />
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
                    <Label htmlFor={`teamB-${match.id}`} className="text-xs">
                      Team B
                    </Label>
                    <Select name="teamB" defaultValue={match.teamBId ?? undefined} items={sectionItems}>
                      <SelectTrigger id={`teamB-${match.id}`} className="h-11 w-44">
                        <SelectValue placeholder="Pick a section" />
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
                  <Button type="submit" size="lg" className="h-11" disabled={busyId === match.id}>
                    Save pairing
                  </Button>
                  <p className="text-muted-foreground w-full text-sm">
                    Setting a pairing by hand stops the bracket from filling this match in
                    automatically — use it for a three-way tie the standings cannot split.
                  </p>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** "Katstraat beat Stopstraat", "Katstraat drew Stopstraat", or who is playing. */
function ResultSummary({ match }: { match: AdminMatch }) {
  if (!match.played || (!match.draw && !match.winnerId)) {
    return (
      <p className="text-sm">
        {match.teamALabel} <span className="text-muted-foreground">v</span> {match.teamBLabel}
      </p>
    );
  }
  const aFirst = match.draw || match.winnerId === match.teamAId;
  const first = aFirst ? match.teamALabel : match.teamBLabel;
  const second = aFirst ? match.teamBLabel : match.teamALabel;
  const hasScores = match.aScore != null && match.bScore != null;
  const score = hasScores
    ? aFirst
      ? `${match.aScore}–${match.bScore}`
      : `${match.bScore}–${match.aScore}`
    : null;
  return (
    <p className="text-sm">
      <span className="font-medium">{first}</span>{" "}
      <span className="text-muted-foreground">{match.draw ? "drew" : "beat"}</span> {second}
      {score && <span className="text-muted-foreground tabular-nums"> · {score}</span>}
    </p>
  );
}

/** A score box accepts whole numbers from 0 up; anything else is "not entered". */
function parseScore(text: string): number | null {
  return /^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : null;
}

// The result form on a score difference event: a score for each team, no
// winner pick and no note. The outcome is shown live as the admin types, and
// the "who went through" question only appears when the scores cannot answer
// it. Nothing saves until the form is complete.
function ScoreEntry({
  match,
  busy,
  onSave,
}: {
  match: AdminMatch;
  busy: boolean;
  onSave: (entry: { aScore: number; bScore: number; winnerSectionId?: string }) => void;
}) {
  const [aText, setAText] = useState(match.aScore == null ? "" : String(match.aScore));
  const [bText, setBText] = useState(match.bScore == null ? "" : String(match.bScore));
  // Only meaningful for level scores that cannot be a draw. Prefilled from a
  // saved result so re-saving an unchanged knockout does not ask again.
  const [through, setThrough] = useState(
    match.aScore != null && match.aScore === match.bScore ? (match.winnerId ?? "") : "",
  );

  const teamsKnown = Boolean(match.teamAId && match.teamBId);
  const aScore = parseScore(aText);
  const bScore = parseScore(bText);
  const outcome = aScore !== null && bScore !== null ? scoreOutcome(aScore, bScore, match.canDraw) : null;
  const needsPick = outcome?.kind === "level";
  const complete = outcome !== null && (!needsPick || through !== "");
  const unchanged =
    match.played &&
    aScore === match.aScore &&
    bScore === match.bScore &&
    (!needsPick || through === match.winnerId);

  const outcomeText =
    outcome?.kind === "win"
      ? `${outcome.side === 0 ? match.teamALabel : match.teamBLabel} win`
      : outcome?.kind === "draw"
        ? "Draw"
        : null;

  const throughItems = [
    { value: match.teamAId ?? "", label: match.teamALabel },
    { value: match.teamBId ?? "", label: match.teamBLabel },
  ];

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`a-score-${match.id}`} className="block max-w-28 truncate text-xs">
            {match.teamALabel}
          </Label>
          <Input
            id={`a-score-${match.id}`}
            type="number"
            inputMode="numeric"
            autoComplete="off"
            min={0}
            step={1}
            value={aText}
            disabled={!teamsKnown}
            onChange={(e) => setAText(e.target.value)}
            className="h-11 w-20 tabular-nums"
          />
        </div>
        <span className="text-muted-foreground pb-3 text-sm" aria-hidden>
          –
        </span>
        <div className="space-y-1">
          <Label htmlFor={`b-score-${match.id}`} className="block max-w-28 truncate text-xs">
            {match.teamBLabel}
          </Label>
          <Input
            id={`b-score-${match.id}`}
            type="number"
            inputMode="numeric"
            autoComplete="off"
            min={0}
            step={1}
            value={bText}
            disabled={!teamsKnown}
            onChange={(e) => setBText(e.target.value)}
            className="h-11 w-20 tabular-nums"
          />
        </div>
        <Button
          size="lg"
          className="h-11"
          disabled={!teamsKnown || !complete || unchanged || busy}
          onClick={() => {
            if (aScore === null || bScore === null) return;
            onSave({
              aScore,
              bScore,
              ...(needsPick ? { winnerSectionId: through } : {}),
            });
          }}
        >
          {busy ? "Saving…" : match.played ? "Update result" : "Save result"}
        </Button>
      </div>

      {/* The live outcome. aria-live so a screen reader hears it change. */}
      <p className="text-sm font-medium" aria-live="polite">
        {outcomeText}
      </p>

      {needsPick && (
        <div className="space-y-1">
          <Label htmlFor={`through-${match.id}`} className="text-xs">
            Scores level — who went through?
          </Label>
          <Select
            value={through}
            items={throughItems}
            onValueChange={(value) => setThrough(String(value))}
          >
            <SelectTrigger id={`through-${match.id}`} className="h-11 w-44">
              <SelectValue placeholder="Pick a section" />
            </SelectTrigger>
            <SelectContent>
              {throughItems.map((item) => (
                <SelectItem key={item.value} value={item.value} className="h-9">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {match.scoreNeeded && match.note && (
        <p className="text-muted-foreground text-sm">Earlier note: {match.note}</p>
      )}
    </div>
  );
}
