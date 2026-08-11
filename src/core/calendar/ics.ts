import { TIME_ZONE } from "@/core/ui/format";

// ICS text generation — pure, no database, so it can be unit-tested (the
// feed that uses it is in ics-feed.ts).
//
// Hand-rolled on purpose: the format is a dozen lines of rules and pulling in
// a library to emit them would be the clever option, not the boring one. The
// two rules that actually bite are escaping (commas, semicolons, backslashes,
// newlines) and folding lines at 75 octets; both are covered by ics.test.ts.

const PRODID = "-//Eendrag//Eendrag App//EN";

export interface IcsEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: Date;
  endsAt?: Date | null;
}

/** RFC 5545 escaping for TEXT values. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets continue on the next line, prefixed by a space. */
export function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length > 0) parts.push(" " + rest);
  return parts.join("\r\n");
}

/** "20260813T170000Z" */
export function icsTimestamp(at: Date): string {
  return at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** A complete VCALENDAR document. `now` is injectable so tests are stable. */
export function buildIcs(
  calendarName: string,
  events: IcsEvent[],
  now: Date = new Date(),
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    `X-WR-TIMEZONE:${TIME_ZONE}`,
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@eendrag`,
      `DTSTAMP:${icsTimestamp(now)}`,
      `DTSTART:${icsTimestamp(event.startsAt)}`,
      // No end time means "an hour", which is what calendar apps assume anyway
      // and beats a zero-length event you cannot see.
      `DTEND:${icsTimestamp(event.endsAt ?? new Date(event.startsAt.getTime() + 3600_000))}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
    );
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
