import { expect, test } from "@playwright/test";

test("setup detail page reports an unavailable database without claiming the setup is missing", async ({ page }) => {
  // The CI Supabase URL is intentionally unreachable. A query failure must
  // render a temporary outage state rather than a misleading not-found page.
  await page.goto("/setups/11111111-1111-1111-1111-111111111111");

  await expect(page.getByRole("heading", { name: "Setup temporarily unavailable" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Browse Setups" })).toBeVisible();
});
