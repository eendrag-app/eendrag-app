import { expect, test, type Page } from "@playwright/test";

// Smoke tests: the app boots, public pages render for anyone, protected pages
// redirect, and a signed-in student sees the things the res actually opens the
// app for. They run against whatever database .env.local points at and only
// READ — nothing here creates or changes res data.
//
// Run with `npm run test:e2e` (it starts the dev server itself). CI does not
// run them because it has no database; see docs/OPERATIONS.md.

const DEV_ADMIN = { email: "admin@eendrag.dev", password: "eendrag-dev-admin" };

async function signIn(page: Page) {
  await page.goto("/login");
  await page.fill("#email", DEV_ADMIN.email);
  await page.fill("#password", DEV_ADMIN.password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/($|\?)/);
}

test.describe("signed out", () => {
  test("intersection is publicly viewable without login", async ({ page }) => {
    await page.goto("/intersection");
    await expect(page.getByRole("heading", { name: "Intersection" })).toBeVisible();
    // The leaderboard is the point of the page — it must render for a visitor
    // who followed a link out of WhatsApp.
    await expect(page.getByText("Leaderboard")).toBeVisible();
  });

  test("an intersection event page opens from a pasted link", async ({ page }) => {
    await page.goto("/intersection");
    const firstEvent = page.locator('a[href^="/intersection/events/"]').first();
    await expect(firstEvent).toBeVisible();
    await firstEvent.click();
    await expect(page).toHaveURL(/\/intersection\/events\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the retired player-stats page is gone, not broken", async ({ page }) => {
    // Rosters and the individual leaderboard were dropped in favour of what
    // the res actually competes over. An old link should 404 rather than
    // error against tables that no longer exist.
    const response = await page.goto("/intersection/players");
    expect(response?.status()).toBe(404);
  });

  test("every group table is laid out the same way", async ({ page }) => {
    await page.goto("/intersection");
    await page.locator('a[href^="/intersection/events/"]').first().click();
    // Wait for the event page itself: counting straight after the click
    // counts the page being navigated away from, which has no tables.
    await expect(page).toHaveURL(/\/intersection\/events\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const tables = page.locator("main table");
    const count = await tables.count();
    test.skip(count === 0, "no event with a draw yet");
    // Auto layout sized each group's columns from its own longest section
    // name, so P and W landed somewhere different on every card.
    for (let i = 0; i < count; i++) {
      await expect(tables.nth(i)).toHaveClass(/table-fixed/);
    }
  });

  test("home redirects signed-out visitors to login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login?next=%2F");
    await expect(page.getByRole("heading", { name: "Sign in to Eendrag" })).toBeVisible();
  });

  test("the tab bar derives from the module registry", async ({ page }) => {
    await page.goto("/intersection");
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const tab of ["Home", "Calendar", "Sport", "Intersection", "Profile"]) {
      await expect(nav.getByRole("link", { name: tab })).toBeVisible();
    }
    // The hidden template module must NOT appear.
    await expect(nav.getByRole("link", { name: "Template" })).toHaveCount(0);
    // Neither must the admin tab, to someone who is not signed in at all.
    await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });

  test("an unknown calendar token is a 404, not a leak", async ({ request }) => {
    const response = await request.get("/api/calendar/00000000-0000-0000-0000-000000000000.ics");
    expect(response.status()).toBe(404);
  });

  test("the cron tick refuses anonymous callers", async ({ request }) => {
    const response = await request.get("/api/cron/tick");
    // 401 when the secret is configured, 503 when it is not — either way, not 200.
    expect([401, 503]).toContain(response.status());
  });
});

test.describe("signed in", () => {
  test("the home page is the feed", async ({ page }) => {
    await signIn(page);
    // <input type="search"> is a searchbox, not a textbox.
    await expect(page.getByRole("searchbox", { name: "Search announcements" })).toBeVisible();
  });

  test("the calendar is its own tab", async ({ page }) => {
    await signIn(page);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Calendar" }).click();
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
    // The month grid, not just the heading.
    await expect(page.getByRole("button", { name: "Next month" })).toBeVisible();
  });

  test("the bell opens and lists notifications", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: /Notifications/ }).click();
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  });

  test("sport lists the sports and opens one", async ({ page }) => {
    await signIn(page);
    await page.goto("/sport");
    const firstSport = page.locator('a[href^="/sport/"]').first();
    await expect(firstSport).toBeVisible();
    await firstSport.click();
    await expect(page.getByRole("heading", { name: "Next practice" })).toBeVisible();
    // The squad list is gone; the going count is what answers "who is coming".
    await expect(page.getByRole("heading", { name: "Squad" })).toHaveCount(0);
  });

  test("a rep's sport page is where the editing lives, not the admin tab", async ({ page }) => {
    await signIn(page);
    await page.goto("/sport/admin");
    // Admins still get the catalogue. What must NOT be here is a second way
    // to edit a sport: that belongs on the sport's own page.
    await expect(page.getByRole("heading", { level: 1, name: "Sports & reps" })).toBeVisible();
    // Back goes to Admin, not Profile — the same for every admin tool.
    await expect(page.locator('a[href="/admin"]').first()).toBeVisible();
  });

  test("profile shows the settings a student needs", async ({ page }) => {
    await signIn(page);
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByLabel("Your calendar feed address")).toHaveValue(/\.ics$/);
  });

  test("the admin tools an HK member needs are all on the admin tab", async ({ page }) => {
    await signIn(page);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    for (const href of [
      "/admin/announcements",
      "/calendar/admin",
      "/sport/admin",
      "/intersection/admin",
      "/profile/members",
    ]) {
      await expect(page.locator(`a[href="${href}"]`)).toBeVisible();
    }
  });
});
