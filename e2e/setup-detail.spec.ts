import { expect, test } from "@playwright/test";

test("setup detail page shows the not-found state with no reachable Supabase", async ({ page }) => {
  // No live Supabase project is reachable here, so getSetupById() always
  // returns null regardless of the id passed.
  await page.goto("/setups/11111111-1111-1111-1111-111111111111");

  await expect(page.getByRole("heading", { name: "Setup not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Browse Setups" }).first()).toBeVisible();
});
