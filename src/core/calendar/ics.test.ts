import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, foldIcsLine, icsTimestamp } from "./ics";

// The ICS text is hand-rolled, so the fiddly parts get tests: escaping,
// folding, and the timestamp shape Google Calendar insists on.

describe("escaping", () => {
  it("escapes the four characters RFC 5545 cares about", () => {
    expect(escapeIcsText("Braai, 19:00; bring meat\\drinks")).toBe(
      "Braai\\, 19:00\\; bring meat\\\\drinks",
    );
  });

  it("turns newlines into literal \\n", () => {
    expect(escapeIcsText("line one\nline two")).toBe("line one\\nline two");
  });
});

describe("folding", () => {
  it("leaves short lines alone", () => {
    expect(foldIcsLine("SUMMARY:Huisvergadering")).toBe("SUMMARY:Huisvergadering");
  });

  it("folds long lines at 75 characters with a leading space", () => {
    const folded = foldIcsLine("DESCRIPTION:" + "x".repeat(200));
    const lines = folded.split("\r\n");
    expect(lines[0]).toHaveLength(75);
    expect(lines.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(lines.slice(1).every((l) => l.length <= 75)).toBe(true);
    // Unfolding (drop every CRLF + the space that follows it) gives it back.
    expect(folded.replace(/\r\n /g, "")).toBe("DESCRIPTION:" + "x".repeat(200));
  });
});

describe("timestamps", () => {
  it("emits UTC basic format", () => {
    expect(icsTimestamp(new Date("2026-08-13T17:00:00Z"))).toBe("20260813T170000Z");
  });
});

describe("buildIcs", () => {
  const now = new Date("2026-08-11T08:00:00Z");
  const ics = buildIcs(
    "Eendrag",
    [
      {
        id: "abc",
        title: "Huisvergadering",
        location: "Eendrag saal",
        description: "Compulsory, all sections",
        startsAt: new Date("2026-08-16T17:00:00Z"),
        endsAt: new Date("2026-08-16T18:00:00Z"),
      },
      {
        id: "def",
        title: "Rugby vs Wilgenhof",
        startsAt: new Date("2026-08-18T16:30:00Z"),
        endsAt: null,
      },
    ],
    now,
  );

  it("wraps events in a VCALENDAR", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it("uses CRLF line endings", () => {
    expect(ics.split("\r\n").length).toBeGreaterThan(10);
    expect(ics.includes("\n\n")).toBe(false);
  });

  it("gives an event with no end time a one-hour slot", () => {
    expect(ics).toContain("DTSTART:20260818T163000Z");
    expect(ics).toContain("DTEND:20260818T173000Z");
  });

  it("skips optional fields that are empty", () => {
    const [, , second] = ics.split("BEGIN:VEVENT");
    expect(second).toContain("SUMMARY:Rugby vs Wilgenhof");
    expect(second).not.toContain("LOCATION:");
  });
});
