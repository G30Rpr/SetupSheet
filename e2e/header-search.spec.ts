import { expect, test } from "@playwright/test";

// The header search box only renders at the `xl:` breakpoint (1280px+);
// set a viewport comfortably past that rather than relying on the exact
// 1280px boundary (see site-header.tsx).
test.use({ viewport: { width: 1440, height: 900 } });

test("header search navigates to /setups?q=...", async ({ page }) => {
  await page.goto("/");

  const searchInput = page.getByRole("textbox", { name: "Search setups" });
  await searchInput.fill("spa porsche");
  await searchInput.press("Enter");

  await expect(page).toHaveURL(/\/setups\?q=spa(\+|%20)porsche/);
});

test("mobile menu exposes the same search flow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "Open menu" }).click();
  const searchInput = page.getByRole("textbox", { name: "Search setups" }).last();
  await searchInput.fill("spa porsche");
  await searchInput.press("Enter");

  await expect(page).toHaveURL(/\/setups\?q=spa(\+|%20)porsche/);
});
