import { describe, expect, it } from "vitest";
import { authorName, isPinned, partitionFeed, statusLabel } from "./announcements";

const now = new Date("2026-08-13T12:00:00Z");
const item = (id: string, isUrgent: boolean, hoursAgo: number) => ({
  id,
  isUrgent,
  publishedAt: new Date(now.getTime() - hoursAgo * 3600_000).toISOString(),
});

describe("urgent pinning", () => {
  it("pins an urgent post for 24 hours", () => {
    expect(isPinned(item("a", true, 1), now)).toBe(true);
    expect(isPinned(item("a", true, 23), now)).toBe(true);
  });

  it("lets it flow normally after that", () => {
    expect(isPinned(item("a", true, 25), now)).toBe(false);
  });

  it("never pins a normal post", () => {
    expect(isPinned(item("a", false, 1), now)).toBe(false);
  });

  it("ignores posts with no publish time", () => {
    expect(isPinned({ id: "a", isUrgent: true, publishedAt: null }, now)).toBe(false);
  });
});

describe("partitionFeed", () => {
  it("splits without duplicating", () => {
    const items = [item("fresh-urgent", true, 2), item("normal", false, 3), item("old-urgent", true, 48)];
    const { pinned, rest } = partitionFeed(items, now);
    expect(pinned.map((i) => i.id)).toEqual(["fresh-urgent"]);
    expect(rest.map((i) => i.id)).toEqual(["normal", "old-urgent"]);
  });

  it("keeps the incoming order inside each group", () => {
    const items = [item("u1", true, 1), item("u2", true, 2)];
    expect(partitionFeed(items, now).pinned.map((i) => i.id)).toEqual(["u1", "u2"]);
  });
});

describe("authorName", () => {
  it("names the author", () => {
    expect(authorName("Jaco Steyn", false)).toBe("Jaco Steyn");
  });

  it("falls back to the HK for system posts and missing authors", () => {
    expect(authorName("Jaco Steyn", true)).toBe("Eendrag HK");
    expect(authorName(null, false)).toBe("Eendrag HK");
    expect(authorName("  ", false)).toBe("Eendrag HK");
  });
});

describe("statusLabel", () => {
  it("reads plainly", () => {
    expect(statusLabel("draft", null)).toBe("Draft");
    expect(statusLabel("published", null)).toBe("Published");
    expect(statusLabel("scheduled", "2026-08-20T10:00:00Z")).toBe("Scheduled");
  });
});
