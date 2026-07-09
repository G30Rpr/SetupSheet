import { expect, test } from "@playwright/test";

test("landing page renders hero and both CTAs", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("right setup");
  await expect(page.getByRole("link", { name: "Browse Setups" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Upload Your Setup" }).first()).toBeVisible();
  await expect(page).toHaveTitle(/SetupSheet/);
});
