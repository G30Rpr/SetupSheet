import { expect, test } from "@playwright/test";

test("compare page without a and b params shows the pick-two guidance state", async ({ page }) => {
  await page.goto("/setups/compare");

  await expect(page.getByRole("heading", { name: "Compare Setups" })).toBeVisible();
  await expect(page.getByText("Pick two setups to compare")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse Setups", exact: true }).first()).toBeVisible();
});

test("compare page with unresolvable ids falls back to the same guidance state", async ({ page }) => {
  // No live Supabase project is reachable here, so getSetupsByIds() always
  // returns [] regardless of the ids passed -- same "couldn't resolve both
  // sides" branch as no params at all.
  await page.goto("/setups/compare?a=11111111-1111-1111-1111-111111111111&b=22222222-2222-2222-2222-222222222222");

  await expect(page.getByText("Pick two setups to compare")).toBeVisible();
});
