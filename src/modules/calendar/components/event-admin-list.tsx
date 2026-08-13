"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eventCategoryColor, eventCategoryLabel } from "@/core/ui/event-categories";
import { addMonths, dayKey, formatLongDate, formatMonthYear, startOfDay } from "@/core/ui/format";
import { ColorDot } from "@/core/ui/section-badge";
import { cn } from "@/lib/utils";
import { deleteEvent } from "../actions";
import { WEEKDAY_LABELS, monthGridKeys } from "../lib/calendar";

export interface AdminEvent {
  id: string;
  title: string;
  category: string;
  whenLabel: string;
  dayKey: string;
  timeLabel: string;
  location: string;
  sectionName: string | null;
  sourceModule: string | null;
}

// The HK's view of the calendar, two ways.
//
// A list answers "what is coming up". A month answers "what is on the 14th",
// which is the question you have when someone asks whether a Thursday is free
// — and it is the same grid the res sees on the Calendar tab, so the two
// screens do not have to be learnt separately. Tapping a day gives you that
// day's events with edit and delete on them, and a button that starts a new
// one already dated.
const MAX_DOTS = 3;

export function EventAdminList({
  items,
  todayKey,
}: {
  items: AdminEvent[];
  todayKey: string;
}) {
  const [view, setView] = useState<"month" | "list">("month");
  const [monthKey, setMonthKey] = useState(todayKey.slice(0, 8) + "01");
  const [selectedDay, setSelectedDay] = useState<string>(todayKey);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  const byDay = useMemo(() => {
    const map = new Map<string, AdminEvent[]>();
    for (const item of items) {
      const list = map.get(item.dayKey);
      if (list) list.push(item);
      else map.set(item.dayKey, [item]);
    }
    return map;
  }, [items]);

  const month = useMemo(() => startOfDay(monthKey), [monthKey]);
  const gridKeys = useMemo(() => monthGridKeys(month), [month]);
  const selectedEvents = byDay.get(selectedDay) ?? [];

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    const result = await deleteEvent(id);
    setBusyId(null);
    setConfirmId(null);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  const rowProps = { confirmId, setConfirmId, busyId, remove };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-1">
        <Button
          size="sm"
          variant={view === "month" ? "secondary" : "ghost"}
          onClick={() => setView("month")}
        >
          Month
        </Button>
        <Button
          size="sm"
          variant={view === "list" ? "secondary" : "ghost"}
          onClick={() => setView("list")}
        >
          List
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {view === "month" ? (
        <>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Previous month"
              onClick={() => setMonthKey(dayKey(addMonths(month, -1)).slice(0, 8) + "01")}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <p className="text-sm font-medium">{formatMonthYear(month)}</p>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Next month"
              onClick={() => setMonthKey(dayKey(addMonths(month, 1)).slice(0, 8) + "01")}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-px text-center">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="text-muted-foreground pb-1 text-xs">
                {label.slice(0, 1)}
                <span className="sr-only">{label}</span>
              </div>
            ))}
            {gridKeys.map((key) => {
              const dayEvents = byDay.get(key) ?? [];
              const inMonth = key.slice(0, 7) === monthKey.slice(0, 7);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  aria-label={`${formatLongDate(startOfDay(key))}, ${dayEvents.length} events`}
                  aria-pressed={key === selectedDay}
                  className={cn(
                    "flex min-h-11 flex-col items-center justify-start gap-1 rounded-lg py-1.5 text-sm",
                    !inMonth && "text-muted-foreground/50",
                    key === todayKey && "font-semibold",
                    key === selectedDay ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <span
                    className={cn(
                      key === todayKey && "bg-primary text-primary-foreground rounded-full px-1.5",
                    )}
                  >
                    {Number(key.slice(8))}
                  </span>
                  <span className="flex h-2 gap-0.5">
                    {dayEvents.slice(0, MAX_DOTS).map((e) => (
                      <ColorDot
                        key={e.id}
                        className="size-1.5"
                        color={eventCategoryColor(e.category)}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">{formatLongDate(startOfDay(selectedDay))}</h3>
              <Button
                variant="outline"
                size="sm"
                className="h-11 sm:h-8"
                nativeButton={false}
                render={<Link href={`/calendar/admin/new?day=${selectedDay}`} />}
              >
                <Plus aria-hidden />
                Add on this day
              </Button>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing on this day.</p>
            ) : (
              <ul className="divide-y">
                {selectedEvents.map((item) => (
                  <EventAdminRow key={item.id} item={item} {...rowProps} />
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <EventAdminRow key={item.id} item={item} {...rowProps} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EventAdminRow({
  item,
  confirmId,
  setConfirmId,
  busyId,
  remove,
}: {
  item: AdminEvent;
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
  busyId: string | null;
  remove: (id: string) => void;
}) {
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          <ColorDot color={eventCategoryColor(item.category)} />
          {item.sectionName ?? eventCategoryLabel(item.category)}
        </Badge>
        {item.sourceModule && (
          <Badge variant="ghost" className="text-muted-foreground">
            <Lock aria-hidden />
            From the {item.sourceModule} module
          </Badge>
        )}
      </div>
      <div>
        <p className="text-sm font-medium">{item.title}</p>
        <p className="text-muted-foreground text-sm">
          {item.whenLabel}
          {item.location ? ` · ${item.location}` : ""}
        </p>
      </div>
      {item.sourceModule ? (
        <p className="text-muted-foreground text-sm">
          Added automatically when the fixture was posted. Change the fixture and this
          follows.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-11 sm:h-8"
            nativeButton={false}
            render={<Link href={`/calendar/admin/${item.id}`} />}
          >
            <Pencil aria-hidden />
            Edit
          </Button>
          {confirmId === item.id ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                className="h-11 sm:h-8"
                disabled={busyId === item.id}
                onClick={() => remove(item.id)}
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
              onClick={() => setConfirmId(item.id)}
            >
              <Trash2 aria-hidden />
              Delete
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
