"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT_CATEGORIES, eventCategoryColor, eventCategoryLabel } from "@/core/ui/event-categories";
import { addMonths, dayKey, formatLongDate, formatMonthYear, startOfDay } from "@/core/ui/format";
import { ColorDot } from "@/core/ui/section-badge";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS,
  groupByDay,
  isInMonth,
  monthGridKeys,
  type CalendarEvent,
} from "../lib/calendar";

// The shared calendar: a month grid or a plain agenda list, coloured by
// category (never by surface — see docs/HANDOFF.md → design direction).
//
// The whole window of events is loaded once by the page and paged through
// here, so flicking between months costs nothing. Sport fixtures and
// intersection games appear because their modules mirror them into the same
// events table; nobody adds those by hand.

const MAX_DOTS = 3;

export function CalendarView({
  events,
  todayKey,
  minMonthKey,
  maxMonthKey,
}: {
  events: CalendarEvent[];
  todayKey: string;
  minMonthKey: string;
  maxMonthKey: string;
}) {
  const [view, setView] = useState<"month" | "agenda">("month");
  const [monthKey, setMonthKey] = useState(todayKey.slice(0, 8) + "01");
  const [selectedDay, setSelectedDay] = useState<string | null>(todayKey);
  const [hidden, setHidden] = useState<string[]>([]);

  const shown = useMemo(
    () => events.filter((e) => !hidden.includes(e.category)),
    [events, hidden],
  );
  const byDay = useMemo(() => groupByDay(shown), [shown]);
  const month = useMemo(() => startOfDay(monthKey), [monthKey]);
  const gridKeys = useMemo(() => monthGridKeys(month), [month]);
  const upcoming = useMemo(
    () => shown.filter((e) => e.dayKey >= todayKey).slice(0, 60),
    [shown, todayKey],
  );

  function step(months: number) {
    const next = dayKey(addMonths(month, months)).slice(0, 8) + "01";
    if (next < minMonthKey || next > maxMonthKey) return;
    setMonthKey(next);
    setSelectedDay(null);
  }

  function toggleCategory(category: string) {
    setHidden((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  }

  const selectedEvents = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4" aria-hidden />
            Calendar
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={view === "month" ? "secondary" : "ghost"}
              onClick={() => setView("month")}
            >
              Month
            </Button>
            <Button
              size="sm"
              variant={view === "agenda" ? "secondary" : "ghost"}
              onClick={() => setView("agenda")}
            >
              Agenda
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {EVENT_CATEGORIES.map((category) => {
            const off = hidden.includes(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategory(category)}
                aria-pressed={!off}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-4xl border px-2 text-xs font-medium",
                  off ? "text-muted-foreground opacity-60" : "text-foreground",
                )}
              >
                <ColorDot color={eventCategoryColor(category)} />
                {eventCategoryLabel(category)}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {view === "month" ? (
          <>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Previous month"
                disabled={monthKey <= minMonthKey}
                onClick={() => step(-1)}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <p className="text-sm font-medium">{formatMonthYear(month)}</p>
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Next month"
                disabled={monthKey >= maxMonthKey}
                onClick={() => step(1)}
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
                const inMonth = isInMonth(key, month);
                const isToday = key === todayKey;
                const isSelected = key === selectedDay;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(key)}
                    aria-label={`${formatLongDate(startOfDay(key))}, ${dayEvents.length} events`}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex min-h-11 flex-col items-center justify-start gap-1 rounded-lg py-1.5 text-sm",
                      !inMonth && "text-muted-foreground/50",
                      isToday && "font-semibold",
                      isSelected ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <span className={cn(isToday && "bg-primary text-primary-foreground rounded-full px-1.5")}>
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

            <div className="space-y-2 border-t pt-3">
              <h3 className="text-sm font-medium">
                {selectedDay ? formatLongDate(startOfDay(selectedDay)) : "Pick a day"}
              </h3>
              {selectedDay && selectedEvents.length === 0 && (
                <p className="text-muted-foreground text-sm">Nothing on this day.</p>
              )}
              <ul className="space-y-2">
                {selectedEvents.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing coming up. Res events, sport fixtures and intersection games all
                land here automatically.
              </p>
            ) : (
              groupAgenda(upcoming).map(([key, dayEvents]) => (
                <div key={key} className="space-y-2">
                  <h3 className="text-muted-foreground text-sm font-medium">
                    {formatLongDate(startOfDay(key))}
                  </h3>
                  <ul className="space-y-2">
                    {dayEvents.map((event) => (
                      <EventRow key={event.id} event={event} />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function groupAgenda(events: CalendarEvent[]): Array<[string, CalendarEvent[]]> {
  return [...groupByDay(events).entries()];
}

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <li className="flex gap-2.5">
      <ColorDot
        className="mt-1.5"
        color={eventCategoryColor(event.category)}
        label={eventCategoryLabel(event.category)}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{event.title}</p>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
          <span>{event.timeLabel}</span>
          {event.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden />
              {event.location}
            </span>
          )}
          {event.sectionName && <span>{event.sectionName}</span>}
        </p>
      </div>
    </li>
  );
}
