"use client";

import { useState } from "react";
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
import { EmptyState } from "@/core/ui/empty-state";
import { SectionBadge } from "@/core/ui/section-badge";
import { updateMember } from "../actions";

export interface Member {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  sectionName: string | null;
}

const ROLE_ITEMS = [
  { value: "student", label: "Student" },
  { value: "sport_rep", label: "Sport rep" },
  { value: "admin", label: "Admin (HK)" },
];

// Year-end housekeeping in one screen: promote the new HK, demote the old
// one, deactivate the people who moved out. Nobody is ever deleted — results
// and announcements must keep their authors (docs/ADMIN-GUIDE.md).
export function MembersList({ members }: { members: Member[] }) {
  const [rows, setRows] = useState(members);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? rows.filter(
        (m) =>
          m.fullName.toLowerCase().includes(needle) ||
          m.email.toLowerCase().includes(needle) ||
          (m.sectionName ?? "").toLowerCase().includes(needle),
      )
    : rows;

  async function save(member: Member, changes: Partial<Member>) {
    const next = { ...member, ...changes };
    setRows((prev) => prev.map((m) => (m.id === member.id ? next : m)));
    setError(null);
    const result = await updateMember(next.id, next.role, next.isActive);
    if (!result.ok) {
      setRows((prev) => prev.map((m) => (m.id === member.id ? member : m)));
      setError(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="member-search">Search</Label>
        <Input
          id="member-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, email or section"
          className="h-11"
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {shown.length === 0 ? (
        <EmptyState
          title="Nobody matches that"
          description="Try part of a name, an email address, or a section."
        />
      ) : (
        <ul className="divide-y">
          {shown.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.fullName || "(no name yet)"}
                </p>
                <p className="text-muted-foreground truncate text-sm">{member.email}</p>
                {member.sectionName && (
                  <SectionBadge name={member.sectionName} className="mt-1" />
                )}
              </div>

              <Select
                value={member.role}
                items={ROLE_ITEMS}
                onValueChange={(role) => save(member, { role: String(role) })}
              >
                <SelectTrigger
                  className="h-11 w-36"
                  aria-label={`Role for ${member.fullName || member.email}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value} className="h-9">
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <label className="flex min-h-11 items-center gap-2 text-sm">
                <Switch
                  checked={member.isActive}
                  onCheckedChange={(isActive) => save(member, { isActive })}
                  aria-label={`Active: ${member.fullName || member.email}`}
                />
                <span className="text-muted-foreground">
                  {member.isActive ? "Active" : "Inactive"}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
