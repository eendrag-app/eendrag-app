"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/core/ui/empty-state";
import { deleteResult } from "../actions";

export interface ResultItem {
  id: string;
  summary: string;
  score: string;
  whenLabel: string;
}

// Results, read-only apart from deleting one.
//
// There is no "post a result" form here any more, on purpose: a result is
// what a fixture becomes when someone enters its score, which happens on the
// fixture itself. Posting one from scratch meant typing the opponent and the
// date a second time, with nothing tying the two records together. Deleting a
// result puts its fixture back to asking for a score, which makes this the
// undo button for a wrong one.
export function ResultList({
  sportId,
  results,
  canEdit,
}: {
  sportId: string;
  results: ResultItem[];
  canEdit: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const router = useRouter();

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

      {results.length === 0 ? (
        <EmptyState
          title="No results yet"
          description="A fixture lands here — and on everyone's feed — as soon as its score is entered."
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

    </div>
  );
}
