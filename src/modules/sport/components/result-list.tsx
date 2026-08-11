"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/core/ui/empty-state";
import { deleteResult, postResult } from "../actions";

export interface ResultItem {
  id: string;
  summary: string;
  score: string;
  whenLabel: string;
}

// Results, and the rep's way of posting one. Posting also writes a short
// announcement to the whole res's feed and notifies the people who play the
// sport — see postResult in ../actions.ts.
export function ResultList({
  sportId,
  results,
  canEdit,
}: {
  sportId: string;
  results: ResultItem[];
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const router = useRouter();

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await postResult(formData);
    setBusy(false);
    if (result.ok) {
      setAdding(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    const result = await deleteResult(id, sportId);
    setBusy(false);
    setConfirmId(null);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-destructive text-sm">{error}</p>}

      {results.length === 0 && !adding ? (
        <EmptyState
          title="No results yet"
          description="They show up here — and on everyone's feed — as soon as the rep posts one."
        />
      ) : (
        <ul className="divide-y">
          {results.map((result) => (
            <li key={result.id} className="space-y-1 py-3">
              <p className="text-sm font-medium">
                {result.summary}
                {result.score ? ` ${result.score}` : ""}
              </p>
              <p className="text-muted-foreground text-sm">{result.whenLabel}</p>
              {canEdit && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {confirmId === result.id ? (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-11 sm:h-8"
                        disabled={busy}
                        onClick={() => remove(result.id)}
                      >
                        Really delete
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
                      size="sm"
                      className="text-muted-foreground h-11 sm:h-8"
                      onClick={() => setConfirmId(result.id)}
                    >
                      <Trash2 aria-hidden />
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit &&
        (adding ? (
          <form action={submit} className="bg-muted/40 space-y-3 rounded-lg p-3">
            <input type="hidden" name="sportId" value={sportId} />
            <div className="space-y-1">
              <Label htmlFor="summary">What happened</Label>
              <Input
                id="summary"
                name="summary"
                placeholder="beat Helshoogte"
                className="h-11"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="score">Score (optional)</Label>
              <Input id="score" name="score" placeholder="3–1" className="h-11" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="lg" className="h-11" disabled={busy}>
                {busy ? "Posting…" : "Post result"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-11"
                onClick={() => setAdding(false)}
              >
                <X aria-hidden />
                Cancel
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              This also posts a one-line announcement on the res feed and tells everyone who
              plays.
            </p>
          </form>
        ) : (
          <Button variant="outline" size="lg" className="h-11" onClick={() => setAdding(true)}>
            <Trophy aria-hidden />
            Post a result
          </Button>
        ))}
    </div>
  );
}
