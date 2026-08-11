"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, MapPin, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/core/ui/empty-state";
import { deleteFixture, saveFixture } from "../actions";

export interface FixtureItem {
  id: string;
  opponent: string;
  location: string;
  notes: string;
  whenLabel: string;
  startsAtInput: string; // datetime-local value, for the edit form
}

// Fixtures, with the rep's editing folded into the same list rather than a
// separate admin screen — the rep manages their sport from the page everyone
// else reads. Every save mirrors the fixture onto the shared calendar.
export function FixtureList({
  sportId,
  fixtures,
  canEdit,
}: {
  sportId: string;
  fixtures: FixtureItem[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const router = useRouter();

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await saveFixture(formData);
    setBusy(false);
    if (result.ok) {
      setEditing(null);
      setAdding(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    const result = await deleteFixture(id, sportId);
    setBusy(false);
    setConfirmId(null);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-destructive text-sm">{error}</p>}

      {fixtures.length === 0 && !adding ? (
        <EmptyState
          title="No fixtures yet"
          description="Check back after the rep posts the schedule."
        />
      ) : (
        <ul className="divide-y">
          {fixtures.map((fixture) =>
            editing === fixture.id ? (
              <li key={fixture.id} className="py-3">
                <FixtureForm
                  sportId={sportId}
                  fixture={fixture}
                  busy={busy}
                  onSubmit={submit}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={fixture.id} className="space-y-1 py-3">
                <p className="text-sm font-medium">
                  {fixture.opponent ? `vs ${fixture.opponent}` : "Fixture"}
                </p>
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
                  <span>{fixture.whenLabel}</span>
                  {fixture.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" aria-hidden />
                      {fixture.location}
                    </span>
                  )}
                </p>
                {fixture.notes && <p className="text-sm">{fixture.notes}</p>}
                {canEdit && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 sm:h-8"
                      onClick={() => setEditing(fixture.id)}
                    >
                      <Pencil aria-hidden />
                      Edit
                    </Button>
                    {confirmId === fixture.id ? (
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-11 sm:h-8"
                          disabled={busy}
                          onClick={() => remove(fixture.id)}
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
                        onClick={() => setConfirmId(fixture.id)}
                      >
                        <Trash2 aria-hidden />
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}

      {canEdit &&
        (adding ? (
          <FixtureForm
            sportId={sportId}
            fixture={null}
            busy={busy}
            onSubmit={submit}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <Button variant="outline" size="lg" className="h-11" onClick={() => setAdding(true)}>
            <CalendarPlus aria-hidden />
            Add a fixture
          </Button>
        ))}
    </div>
  );
}

function FixtureForm({
  sportId,
  fixture,
  busy,
  onSubmit,
  onCancel,
}: {
  sportId: string;
  fixture: FixtureItem | null;
  busy: boolean;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
}) {
  const id = fixture?.id ?? "new";
  return (
    <form action={onSubmit} className="bg-muted/40 space-y-3 rounded-lg p-3">
      <input type="hidden" name="sportId" value={sportId} />
      {fixture && <input type="hidden" name="id" value={fixture.id} />}

      <div className="space-y-1">
        <Label htmlFor={`opponent-${id}`}>Against</Label>
        <Input
          id={`opponent-${id}`}
          name="opponent"
          defaultValue={fixture?.opponent ?? ""}
          placeholder="Wilgenhof"
          className="h-11"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`startsAt-${id}`}>When</Label>
        <Input
          id={`startsAt-${id}`}
          name="startsAt"
          type="datetime-local"
          defaultValue={fixture?.startsAtInput ?? ""}
          className="h-11"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`location-${id}`}>Where</Label>
        <Input
          id={`location-${id}`}
          name="location"
          defaultValue={fixture?.location ?? ""}
          placeholder="Coetzenburg B-field"
          className="h-11"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`notes-${id}`}>Notes (optional)</Label>
        <Input
          id={`notes-${id}`}
          name="notes"
          defaultValue={fixture?.notes ?? ""}
          placeholder="League round 3"
          className="h-11"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="lg" className="h-11" disabled={busy}>
          {busy ? "Saving…" : fixture ? "Save fixture" : "Post fixture"}
        </Button>
        <Button type="button" variant="ghost" size="lg" className="h-11" onClick={onCancel}>
          <X aria-hidden />
          Cancel
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        It appears on everyone&apos;s calendar automatically, and players are told when a
        fixture is new or moves.
      </p>
    </form>
  );
}
