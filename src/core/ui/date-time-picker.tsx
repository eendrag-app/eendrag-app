"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  addDays,
  addMonths,
  dayKey,
  formatDateTime,
  formatLongDate,
  formatMonthYear,
  fromLocalInput,
  startOfDay,
  startOfMonth,
  weekdayIndex,
} from "./format";

// Picking when something happens: a month to tap a day on, and two wheels for
// the time — the way a phone's alarm clock does it.
//
// It replaces `<input type="datetime-local">`, which is a different control on
// every browser, needs a keyboard on some of them, and on Android hides the
// date behind a spinner nobody can read at arm's length. This looks the same
// everywhere and is all thumbs, no typing.
//
// The value in and out is the SAME string the native input used —
// "2026-08-20T19:00", res wall-clock time — so `fromLocalInput` and
// `toLocalInput` in ./format stay the only place that knows about timezones,
// and callers did not have to change.

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
// Five-minute steps: this schedules res fixtures, not train departures. Fewer
// rows also means the wheel is flickable rather than a scroll marathon.
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

/** The six-week grid of day keys containing `month`, Monday first. */
function monthGrid(month: Date): string[] {
  const first = startOfMonth(month);
  const start = addDays(first, -weekdayIndex(first));
  return Array.from({ length: 42 }, (_, i) => dayKey(addDays(start, i)));
}

function splitValue(value: string): { day: string; hour: string; minute: string } | null {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  return { day: match[1], hour: match[2], minute: match[3] };
}

/** Snap a minute to the nearest step the wheel actually offers. */
function nearestMinute(minute: string): string {
  const n = Number(minute);
  const snapped = Math.min(55, Math.round(n / 5) * 5);
  return String(snapped).padStart(2, "0");
}

export function DateTimePicker({
  value,
  onChange,
  id,
  label = "When",
  mode = "datetime",
  clearable = true,
  className,
}: {
  /** "2026-08-20T19:00" in datetime mode, "2026-08-20" in date mode, "" for nothing set. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
  /** "date" drops the clock — for things that happen on a day, not at a time. */
  mode?: "datetime" | "date";
  /** Whether "nothing set" is an allowed answer. */
  clearable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const dateOnly = mode === "date";
  const parsed = splitValue(dateOnly ? `${value}T00:00` : value);
  const todayKey = dayKey(new Date());

  // Draft state: nothing is committed until Done, so a half-made change
  // ("I picked the day, now the time") never writes a wrong time to the
  // server on the way past.
  const [day, setDay] = useState(parsed?.day ?? todayKey);
  const [hour, setHour] = useState(parsed?.hour ?? "18");
  const [minute, setMinute] = useState(nearestMinute(parsed?.minute ?? "00"));
  const [monthKey, setMonthKey] = useState((parsed?.day ?? todayKey).slice(0, 8) + "01");

  // Reopening starts from whatever is saved now, not from where the last
  // visit was abandoned. Done on the way in rather than in an effect: opening
  // is an event, and syncing this in an effect would re-render the sheet a
  // second time every time it appeared.
  function open_() {
    const current = splitValue(dateOnly ? `${value}T00:00` : value);
    setDay(current?.day ?? todayKey);
    setHour(current?.hour ?? "18");
    setMinute(nearestMinute(current?.minute ?? "00"));
    setMonthKey((current?.day ?? todayKey).slice(0, 8) + "01");
    setOpen(true);
  }

  const month = useMemo(() => startOfDay(monthKey), [monthKey]);
  const grid = useMemo(() => monthGrid(month), [month]);

  function commit() {
    onChange(dateOnly ? day : `${day}T${hour}:${minute}`);
    setOpen(false);
  }

  function clear() {
    onChange("");
    setOpen(false);
  }

  return (
    <>
      <Button
        id={id}
        type="button"
        variant="outline"
        size="lg"
        className={cn("h-11 justify-start font-normal", className)}
        onClick={open_}
      >
        <CalendarDays className="text-muted-foreground" aria-hidden />
        {value
          ? dateOnly
            ? formatLongDate(startOfDay(value))
            : formatDateTime(fromLocalInput(value))
          : dateOnly
            ? "Pick a date"
            : "Pick a date and time"}
      </Button>

      <Sheet open={open} onOpenChange={(next) => (next ? open_() : setOpen(false))}>
        <SheetContent side="bottom" className="mx-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{label}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-6">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label="Previous month"
                onClick={() => setMonthKey(dayKey(addMonths(month, -1)).slice(0, 8) + "01")}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <p className="text-sm font-medium">{formatMonthYear(month)}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label="Next month"
                onClick={() => setMonthKey(dayKey(addMonths(month, 1)).slice(0, 8) + "01")}
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-px text-center">
              {WEEKDAYS.map((name) => (
                <div key={name} className="text-muted-foreground pb-1 text-xs">
                  {name.slice(0, 1)}
                  <span className="sr-only">{name}</span>
                </div>
              ))}
              {grid.map((key) => {
                const inMonth = key.slice(0, 7) === monthKey.slice(0, 7);
                const selected = key === day;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDay(key)}
                    aria-label={formatLongDate(startOfDay(key))}
                    aria-pressed={selected}
                    className={cn(
                      "flex min-h-11 items-center justify-center rounded-lg text-sm",
                      !inMonth && "text-muted-foreground/50",
                      key === todayKey && "font-semibold",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted/60",
                    )}
                  >
                    {Number(key.slice(8))}
                  </button>
                );
              })}
            </div>

            {!dateOnly && (
              <div className="space-y-2 border-t pt-3">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Clock className="size-4" aria-hidden />
                  Time
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Wheel label="Hour" options={HOURS} value={hour} onSelect={setHour} />
                  <span className="text-2xl font-semibold">:</span>
                  <Wheel label="Minute" options={MINUTES} value={minute} onSelect={setMinute} />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button type="button" size="lg" className="h-11 flex-1" onClick={commit}>
                Done
              </Button>
              {clearable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="text-muted-foreground h-11"
                  onClick={clear}
                >
                  {dateOnly ? "No date yet" : "No time yet"}
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// One column of the clock. A plain scrolling list with snap points: the same
// gesture as a native picker, with none of the maths — the browser does the
// snapping, and a keyboard user still just tabs onto a button and presses it.
function Wheel({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: string[];
  value: string;
  onSelect: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Bring the current value into view when the sheet opens; without this the
  // wheel starts at midnight and 19:00 is off-screen.
  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    const index = options.indexOf(value);
    if (index < 0) return;
    const item = list.children[index] as HTMLElement | undefined;
    if (item) list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2;
  }, [options, value]);

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      className="h-40 w-20 snap-y snap-mandatory overflow-y-auto rounded-lg border py-14 text-center"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="option"
          aria-selected={option === value}
          onClick={() => onSelect(option)}
          className={cn(
            "flex h-12 w-full snap-center items-center justify-center text-lg tabular-nums",
            option === value ? "text-foreground font-semibold" : "text-muted-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
