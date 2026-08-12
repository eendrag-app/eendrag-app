import { Clock, Crown } from "lucide-react";
import { formatDateTime } from "@/core/ui/format";
import { cn } from "@/lib/utils";
import { sourceLabel, type Match } from "../lib/tournament";

// One fixture, read-only. Used by the public event page for every stage —
// a group game and a semi-final differ only in what they can say about who is
// playing: a group game always knows, a knockout may still be waiting on
// "Group A winner".
export function MatchRow({
  match,
  note,
  nameOf,
  mySectionId,
}: {
  match: Match;
  note: string | null;
  nameOf: (id: string) => string;
  /** The reader's own section, so their games stand out. Null when signed out. */
  mySectionId?: string | null;
  scheduledAt?: string | null;
}) {
  const mine =
    mySectionId != null && (match.teamAId === mySectionId || match.teamBId === mySectionId);
  return (
    // A game the reader is in gets a tinted strip. The page is public, so this
    // is simply absent for a visitor who followed a link out of WhatsApp.
    <div className={cn("space-y-1 py-2.5", mine && "bg-primary/8 -mx-2 rounded-lg px-2")}>
      <div className="flex items-center gap-2">
        <Side
          sectionId={match.teamAId}
          fallback={match.sources?.[0]}
          isWinner={match.played && match.winnerId === match.teamAId}
          isMine={match.teamAId != null && match.teamAId === mySectionId}
          nameOf={nameOf}
        />
        <span className="text-muted-foreground text-xs">v</span>
        <Side
          sectionId={match.teamBId}
          fallback={match.sources?.[1]}
          isWinner={match.played && match.winnerId === match.teamBId}
          isMine={match.teamBId != null && match.teamBId === mySectionId}
          nameOf={nameOf}
        />
      </div>
      {note && <p className="text-muted-foreground text-sm">{note}</p>}
    </div>
  );
}

function Side({
  sectionId,
  fallback,
  isWinner,
  isMine,
  nameOf,
}: {
  sectionId: string | null;
  fallback?: string;
  isWinner: boolean;
  isMine: boolean;
  nameOf: (id: string) => string;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
      {sectionId ? (
        <>
          <span
            className={cn(
              "truncate",
              isWinner && "font-semibold",
              isMine && "text-primary font-semibold",
            )}
          >
            {nameOf(sectionId)}
          </span>
          {isWinner && <Crown className="size-3.5 shrink-0" aria-label="Winner" />}
        </>
      ) : (
        <span className="text-muted-foreground truncate italic">
          {fallback ? sourceLabel(fallback) : "To be decided"}
        </span>
      )}
    </span>
  );
}

/** "Sat 15 Aug, 09:00", or nothing when the match has no time yet. */
export function MatchTime({ scheduledAt }: { scheduledAt: string | null }) {
  if (!scheduledAt) return null;
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      <Clock className="size-3" aria-hidden />
      {formatDateTime(scheduledAt)}
    </span>
  );
}
