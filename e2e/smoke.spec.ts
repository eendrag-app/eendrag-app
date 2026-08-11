import { expect, test } from "@playwright/test";

// Smoke tests: the app boots, public pages render, protected pages redirect.
// Needs a filled-in .env.local (the dev server the config starts reads it).

test("intersection is publicly viewable without login", async ({ page }) => {
  await page.goto("/intersection");
  await expect(page.getByRole("heading", { name: "Intersection" })).toBeVisible();
});

test("home redirects signed-out visitors to login", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/login?next=%2F");
  await expect(page.getByRole("heading", { name: "Sign in to Eendrag" })).toBeVisible();
});

test("the tab bar derives from the module registry", async ({ page }) => {
  await page.goto("/intersection");
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const tab of ["Home", "Sport", "Intersection", "Profile"]) {
    await expect(nav.getByRole("link", { name: tab })).toBeVisible();
  }
  // The hidden template module must NOT appear.
  await expect(nav.getByRole("link", { name: "Template" })).toHaveCount(0);
});
