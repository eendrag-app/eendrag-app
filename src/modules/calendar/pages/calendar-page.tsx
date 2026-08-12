import { listEventsBetween } from "@/core/calendar";
import { createClient } from "@/core/db/server";
import { requireProfile } from "@/core/permissions";
import { addMonths, dayKey, formatTime, startOfMonth } from "@/core/ui/format";
import { CalendarView } from "../components/calendar-view";
import { WINDOW_MONTHS_AHEAD, WINDOW_MONTHS_BACK, type CalendarEvent } from "../lib/calendar";

export const metadata = { title: "Calendar" };

// The whole res calendar, on its own screen. One query loads a window of a
// month back to a year ahead and the component pages through months in the
// browser — flicking between months should never wait on the network.
export default async function CalendarPage() {
  await requireProfile();
  const db = await createClient();
  const now = new Date();

  const windowStart = startOfMonth(addMonths(now, -WINDOW_MONTHS_BACK));
  const windowEnd = addMonths(now, WINDOW_MONTHS_AHEAD);
  const [eventRows, sections] = await Promise.all([
    listEventsBetween(windowStart, windowEnd),
    db.from("sections").select("id, name"),
  ]);
  const sectionById = new Map((sections.data ?? []).map((s) => [s.id, s]));
  const events: CalendarEvent[] = eventRows.map((e) => {
    const section = e.section_id ? sectionById.get(e.section_id) : undefined;
    return {
      id: e.id,
      title: e.title,
      category: e.category,
      location: e.location,
      dayKey: dayKey(e.starts_at),
      timeLabel: formatTime(e.starts_at),
      sectionName: section?.name ?? null,
      sourceModule: e.source_module,
    };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Calendar</h1>
      <p className="text-muted-foreground -mt-2 text-sm">
        Everything the res has on: huisvergaderings and sokkies, sport fixtures, and
        intersection games. Subscribe to it from your phone under Profile.
      </p>

      <CalendarView
        events={events}
        todayKey={dayKey(now)}
        minMonthKey={dayKey(windowStart).slice(0, 8) + "01"}
        maxMonthKey={dayKey(windowEnd).slice(0, 8) + "01"}
      />
    </div>
  );
}
