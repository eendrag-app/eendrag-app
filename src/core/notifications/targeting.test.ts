import { describe, expect, it } from "vitest";
import { resolveRecipients } from "./targeting";
import type { NotificationTrigger, RecipientCandidate } from "./types";

// THE TARGETING CONTRACT. These tests pin down who receives what. Phase two
// builds triggers against this exact behaviour — change it knowingly or not
// at all.

// Stable fake ids, readable in failures.
const INGANG = "section-ingang";
const ROUTE_61 = "section-route61";
const KATSTRAAT = "section-katstraat";
const HOCKEY = "sport-hockey";
const SQUASH = "sport-squash";

function candidate(overrides: Partial<RecipientCandidate>): RecipientCandidate {
  return {
    profileId: "p-" + Math.random().toString(36).slice(2, 8),
    sectionId: INGANG,
    role: "student",
    isActive: true,
    sportIds: [],
    preferences: {},
    quietHoursStart: "23:00",
    quietHoursEnd: "07:00",
    ...overrides,
  };
}

function trigger(overrides: Partial<NotificationTrigger>): NotificationTrigger {
  return {
    category: "announcement",
    title: "Test",
    sourceModule: "home",
    audience: { kind: "all" },
    ...overrides,
  };
}

// The two canonical users from the spec: a hockey player in Ingang and a
// squash player in Route 61. They must demonstrably receive different sets.
const hockeyIngang = candidate({
  profileId: "hockey-player-ingang",
  sectionId: INGANG,
  sportIds: [HOCKEY],
});
const squashRoute61 = candidate({
  profileId: "squash-player-route61",
  sectionId: ROUTE_61,
  sportIds: [SQUASH],
});
const everyone = [hockeyIngang, squashRoute61];

describe("audience targeting", () => {
  it("res-wide announcements reach both users", () => {
    const got = resolveRecipients(trigger({ audience: { kind: "all" } }), everyone);
    expect(got.map((c) => c.profileId).sort()).toEqual([
      "hockey-player-ingang",
      "squash-player-route61",
    ]);
  });

  it("a section announcement reaches only that section", () => {
    const got = resolveRecipients(
      trigger({ audience: { kind: "section", sectionId: INGANG } }),
      everyone,
    );
    expect(got.map((c) => c.profileId)).toEqual(["hockey-player-ingang"]);
  });

  it("a hockey practice change reaches the hockey player, not the squash player", () => {
    const got = resolveRecipients(
      trigger({ category: "sport", audience: { kind: "sport", sportId: HOCKEY } }),
      everyone,
    );
    expect(got.map((c) => c.profileId)).toEqual(["hockey-player-ingang"]);
  });

  it("a squash practice change reaches the squash player, not the hockey player", () => {
    const got = resolveRecipients(
      trigger({ category: "sport", audience: { kind: "sport", sportId: SQUASH } }),
      everyone,
    );
    expect(got.map((c) => c.profileId)).toEqual(["squash-player-route61"]);
  });

  it("the two spec users receive demonstrably different sets overall", () => {
    const triggers = [
      trigger({ audience: { kind: "all" }, title: "res-wide" }),
      trigger({
        category: "sport",
        audience: { kind: "sport", sportId: HOCKEY },
        title: "hockey",
      }),
      trigger({
        category: "intersection",
        audience: { kind: "section", sectionId: ROUTE_61 },
        title: "route61 fixture",
      }),
    ];
    const inbox = (id: string) =>
      triggers
        .filter((t) => resolveRecipients(t, everyone).some((c) => c.profileId === id))
        .map((t) => t.title);
    expect(inbox("hockey-player-ingang")).toEqual(["res-wide", "hockey"]);
    expect(inbox("squash-player-route61")).toEqual(["res-wide", "route61 fixture"]);
  });

  it("role targeting reaches only that role", () => {
    const admin = candidate({ profileId: "the-admin", role: "admin" });
    const got = resolveRecipients(
      trigger({ audience: { kind: "role", role: "admin" } }),
      [...everyone, admin],
    );
    expect(got.map((c) => c.profileId)).toEqual(["the-admin"]);
  });
});

describe("preference filtering", () => {
  it("a disabled category toggle silences that category", () => {
    const muted = candidate({
      profileId: "muted",
      preferences: { announcement: false },
    });
    expect(resolveRecipients(trigger({}), [muted])).toEqual([]);
  });

  it("missing preference rows fall back to enabled", () => {
    const noPrefs = candidate({ profileId: "no-prefs", preferences: {} });
    expect(resolveRecipients(trigger({}), [noPrefs])).toHaveLength(1);
  });

  it("urgent bypasses the category toggle but honours the urgent toggle", () => {
    const mutedAnnouncements = candidate({
      profileId: "muted-announcements",
      preferences: { announcement: false },
    });
    const mutedUrgent = candidate({
      profileId: "muted-urgent",
      preferences: { urgent: false },
    });
    const got = resolveRecipients(trigger({ urgent: true }), [
      mutedAnnouncements,
      mutedUrgent,
    ]);
    expect(got.map((c) => c.profileId)).toEqual(["muted-announcements"]);
  });

  it("inactive accounts never receive anything, even urgent", () => {
    const left = candidate({ profileId: "left-the-res", isActive: false });
    expect(resolveRecipients(trigger({ urgent: true }), [left])).toEqual([]);
  });
});

describe("section-only mode", () => {
  const sectionOnly = candidate({
    profileId: "section-only-katstraat",
    sectionId: KATSTRAAT,
    preferences: { section: true },
  });

  it("drops res-wide notifications not about their section", () => {
    expect(resolveRecipients(trigger({}), [sectionOnly])).toEqual([]);
  });

  it("keeps notifications about their own section", () => {
    const got = resolveRecipients(
      trigger({
        category: "intersection",
        audience: { kind: "all" },
        aboutSectionId: KATSTRAAT,
        title: "Katstraat move to 2nd",
      }),
      [sectionOnly],
    );
    expect(got).toHaveLength(1);
  });

  it("keeps section-audience notifications for their section", () => {
    const got = resolveRecipients(
      trigger({ audience: { kind: "section", sectionId: KATSTRAAT } }),
      [sectionOnly],
    );
    expect(got).toHaveLength(1);
  });

  it("urgent still gets through section-only mode", () => {
    const got = resolveRecipients(trigger({ urgent: true }), [sectionOnly]);
    expect(got).toHaveLength(1);
  });
});
