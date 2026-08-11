"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { assignRep, createSport, setSportActive } from "../actions";

export interface AdminSport {
  id: string;
  name: string;
  isActive: boolean;
  repId: string | null;
}

export interface RepCandidate {
  id: string;
  label: string;
}

const NOBODY = "none";

// Add a sport, retire one at the end of a season, and say who runs it.
// Appointing a rep also gives them the sport_rep role, so it is one action
// rather than a trip to Members as well.
export function SportAdminList({
  sports,
  people,
}: {
  sports: AdminSport[];
  people: RepCandidate[];
}) {
  const [rows, setRows] = useState(sports);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const repItems = [{ value: NOBODY, label: "Nobody yet" }, ...people.map((p) => ({ value: p.id, label: p.label }))];

  async function add(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await createSport(formData);
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  async function toggleActive(sport: AdminSport, isActive: boolean) {
    setRows((prev) => prev.map((s) => (s.id === sport.id ? { ...s, isActive } : s)));
    setError(null);
    const result = await setSportActive(sport.id, isActive);
    if (!result.ok) {
      setRows((prev) => prev.map((s) => (s.id === sport.id ? sport : s)));
      setError(result.error);
    }
  }

  async function setRep(sport: AdminSport, value: string) {
    const repId = value === NOBODY ? null : value;
    setRows((prev) => prev.map((s) => (s.id === sport.id ? { ...s, repId } : s)));
    setError(null);
    const result = await assignRep(sport.id, repId);
    if (!result.ok) {
      setRows((prev) => prev.map((s) => (s.id === sport.id ? sport : s)));
      setError(result.error);
    } else {
      router.refresh();
    }
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
          <li key={sport.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <Link href={`/sport/${sport.id}`} className="text-sm font-medium hover:underline">
                {sport.name}
              </Link>
            </div>

            <div className="space-y-1">
              <Select
                value={sport.repId ?? NOBODY}
                items={repItems}
                onValueChange={(value) => setRep(sport, String(value))}
              >
                <SelectTrigger className="h-11 w-52" aria-label={`Rep for ${sport.name}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {repItems.map((item) => (
                    <SelectItem key={item.value} value={item.value} className="h-9">
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex min-h-11 items-center gap-2 text-sm">
              <Switch
                checked={sport.isActive}
                onCheckedChange={(isActive) => toggleActive(sport, isActive)}
                aria-label={`${sport.name} is running`}
              />
              <span className="text-muted-foreground">
                {sport.isActive ? "Running" : "Paused"}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
