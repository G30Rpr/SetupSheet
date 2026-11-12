import { expect, test } from "@playwright/test";

// Runs only with Playwright's Pixel 7 touch emulation. The actual browser is
// Chromium; this does not replace Safari/Android real-device release QA.
test("touch navigation opens and closes the mobile menu", async ({ page }) => {
  await page.goto("/help", { waitUntil: "domcontentloaded" });
  const menu = page.getByRole("button", { name: "Open menu" });
  await expect(menu).toBeVisible();
  await menu.tap();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Browse" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(menu).toBeFocused();
});

test("touch users can open mobile browse filters without horizontal scrolling", async ({ page }) => {
  await page.goto("/setups", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Browse Setups" })).toBeVisible();
  const show = page.getByRole("button", { name: "Show filters" });
  await show.tap();
  await expect(page.getByRole("button", { name: "Hide filters" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Uploader rig", { exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Hide filters" }).tap();
  await expect(show).toBeVisible();
});

test("touch users can reach Help FAQs and the anonymous upload gate", async ({ page }) => {
  await page.goto("/help", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Help using SetupSheet" })).toBeVisible();
  await expect(page.getByText(/not independent verification by SetupSheet/)).toBeVisible();
  const upload = page.getByRole("link", { name: "Share a setup" });
  await upload.tap();
  await expect(page).toHaveURL(/\/upload(?:[?#]|$)/);
  await expect(page.getByRole("heading", { name: /Sign in with Discord to share a setup/ })).toBeVisible();
});
