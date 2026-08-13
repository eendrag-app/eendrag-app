"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSport, deleteSport, saveRep } from "../actions";

export interface AdminSport {
  id: string;
  name: string;
  repName: string;
  repPhone: string;
  repEmail: string;
  /** Set once the email matches a real account — that is when editing works. */
  repLinked: boolean;
}

// Add a sport, delete one the res no longer plays, and say who runs it.
//
// Reps are typed in, not chosen from a list of accounts. The HK knows who runs
// hockey long before that person opens the app, and the old dropdown could
// only appoint someone who had already signed up.
export function SportAdminList({ sports }: { sports: AdminSport[] }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();
  const rows = sports;

  async function add(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await createSport(formData);
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  async function remove(sport: AdminSport) {
    setDeletingId(sport.id);
    setError(null);
    const result = await deleteSport(sport.id);
    setDeletingId(null);
    setConfirmId(null);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <div className="space-y-4">
      <form action={add} className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor="name">Add a sport</Label>
          <Input id="name" name="name" placeholder="Netball" className="h-11" required />
        </div>
        <Button type="submit" size="lg" className="h-11" disabled={busy}>
          <Plus aria-hidden />
          Add
        </Button>
      </form>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <ul className="divide-y">
        {rows.map((sport) => (
          <li key={sport.id} className="space-y-3 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <Link href={`/sport/${sport.id}`} className="text-sm font-medium hover:underline">
                  {sport.name}
                </Link>
              </div>
              {/* Two taps, and the second one says what it takes with it —
                  deleting a sport is not something to do by brushing past a
                  bin icon on a phone. */}
              {confirmId === sport.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-11 sm:h-8"
                    disabled={deletingId === sport.id}
                    onClick={() => remove(sport)}
                  >
                    {deletingId === sport.id ? "Deleting…" : "Really delete"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11 sm:h-8"
                    onClick={() => setConfirmId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-11 sm:h-8"
                  onClick={() => setConfirmId(sport.id)}
                >
                  <Trash2 aria-hidden />
                  Delete
                </Button>
              )}
            </div>
            {confirmId === sport.id && (
              <p className="text-muted-foreground text-sm">
                This deletes {sport.name} along with its fixtures, results and everyone who
                signed up for it, and takes its games off the calendar. There is no undo.
              </p>
            )}
            <RepFields sport={sport} onSaved={() => router.refresh()} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// One sport's rep. Kept as its own component so each row owns its own busy
// and saved state — with a single shared flag, saving hockey would flicker
// every other row on the page.
function RepFields({ sport, onSaved }: { sport: AdminSport; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<"linked" | "waiting" | "cleared" | null>(null);

  async function save(formData: FormData) {
    setBusy(true);
    setError(null);
    setSaved(null);
    // Read the email before awaiting: clearing it is a third outcome, and
    // saying "they get access when they sign up with that email" when the
    // field is now empty is a sentence about nobody.
    const email = String(formData.get("email") ?? "").trim();
    const result = await saveRep(formData);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(email === "" ? "cleared" : result.linked ? "linked" : "waiting");
    onSaved();
  }

  return (
    <form action={save} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
      <input type="hidden" name="sportId" value={sport.id} />
      <div className="space-y-1">
        <Label htmlFor={`rep-name-${sport.id}`}>Rep</Label>
        <Input
          id={`rep-name-${sport.id}`}
          name="name"
          defaultValue={sport.repName}
          placeholder="Jan de Villiers"
          className="h-11"
          autoComplete="off"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`rep-phone-${sport.id}`}>Phone</Label>
        <Input
          id={`rep-phone-${sport.id}`}
          name="phone"
          type="tel"
          defaultValue={sport.repPhone}
          placeholder="082 123 4567"
          className="h-11"
          autoComplete="off"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`rep-email-${sport.id}`}>Student email</Label>
        <Input
          id={`rep-email-${sport.id}`}
          name="email"
          type="email"
          defaultValue={sport.repEmail}
          placeholder="24681357@sun.ac.za"
          className="h-11"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>
      <Button type="submit" variant="outline" size="lg" className="h-11" disabled={busy}>
        {busy ? "Saving…" : "Save rep"}
      </Button>

      <p className="text-muted-foreground text-sm sm:col-span-4">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : saved === "linked" ? (
          <span className="text-foreground inline-flex items-center gap-1">
            <Check className="size-4" aria-hidden />
            Saved — they can edit {sport.name} now.
          </span>
        ) : saved === "waiting" ? (
          // Not a failure, and worth saying plainly: an admin who typed an
          // address and saw nothing happen would reasonably assume it broke.
          <>Saved. They get access to {sport.name} the moment they sign up with that email.</>
        ) : saved === "cleared" ? (
          <>Saved — nobody runs {sport.name} now, and the old rep can no longer edit it.</>
        ) : sport.repEmail === "" ? (
          <>The student email is what gives the rep permission to edit this sport.</>
        ) : sport.repLinked ? (
          <>{sport.repEmail} can edit {sport.name}.</>
        ) : (
          <>Waiting for {sport.repEmail} to sign up — no account with that address yet.</>
        )}
      </p>
    </form>
  );
}
