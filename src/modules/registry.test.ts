import { describe, expect, it } from "vitest";
import { allAdminPanels, modules, moduleForPath, navModules } from "./registry";

// The registry is the app's wiring. These pin the things that would break
// quietly: a tab appearing for the wrong person, two modules claiming the same
// path, an admin panel pointing at a route nobody owns.

describe("navModules", () => {
  it("hides role-restricted tabs from students and from signed-out visitors", () => {
    const student = navModules("student").map((m) => m.id);
    const signedOut = navModules(null).map((m) => m.id);
    expect(student).not.toContain("admin");
    expect(signedOut).not.toContain("admin");
    // Everything without a `roles` list is still there.
    expect(student).toEqual(["home", "calendar", "sport", "intersection", "profile"]);
  });

  it("shows the admin tab to the HK and to sport reps", () => {
    expect(navModules("admin").map((m) => m.id)).toContain("admin");
    expect(navModules("sport_rep").map((m) => m.id)).toContain("admin");
  });

  it("orders tabs by `order`, with the calendar between home and sport", () => {
    expect(navModules("admin").map((m) => m.id)).toEqual([
      "home",
      "calendar",
      "sport",
      "intersection",
      "admin",
      "profile",
    ]);
  });

  it("leaves hidden modules out of the tab bar entirely", () => {
    expect(navModules("admin").map((m) => m.id)).not.toContain("template");
  });
});

describe("moduleForPath", () => {
  it("matches the longest basePath, so '/' does not swallow everything", () => {
    expect(moduleForPath("/")?.id).toBe("home");
    expect(moduleForPath("/calendar")?.id).toBe("calendar");
    expect(moduleForPath("/calendar/admin/new")?.id).toBe("calendar");
    expect(moduleForPath("/sport/hockey")?.id).toBe("sport");
  });

  it("gives the admin module everything under /admin", () => {
    // Announcements admin lives at /admin/announcements because the home
    // module's basePath is "/" and cannot nest. The admin module owning the
    // subtree is what makes it require auth.
    expect(moduleForPath("/admin")?.id).toBe("admin");
    expect(moduleForPath("/admin/announcements")?.id).toBe("admin");
  });
});

describe("admin panels", () => {
  it("are unique and point at a route some module owns", () => {
    const panels = allAdminPanels();
    expect(new Set(panels.map((p) => p.id)).size).toBe(panels.length);
    for (const panel of panels) {
      expect(moduleForPath(panel.href), `${panel.href} belongs to no module`).toBeDefined();
    }
  });
});

describe("module ids and paths", () => {
  it("are unique", () => {
    expect(new Set(modules.map((m) => m.id)).size).toBe(modules.length);
    expect(new Set(modules.map((m) => m.basePath)).size).toBe(modules.length);
  });
});
