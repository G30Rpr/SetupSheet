import { expect, test } from "@playwright/test";

const widths = [390, 768, 1024, 1280, 1440];

test("landing and Help are readable at release viewport widths", async ({ page }) => {
  for (const route of ["/", "/help"]) {
    // Load each server-backed route only once. Viewport changes do not require
    // refetching failed/slow CI database requests.
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `Horizontal overflow at ${width}px on ${route}`).toBeLessThanOrEqual(1);
    }
  }
});

test("primary desktop nav is accessible at 1024px", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav.getByRole("link", { name: "Browse" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Engineer" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Requests" })).toBeVisible();
});

test("mobile browse exposes and collapses filter controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/setups");
  const open = page.getByRole("button", { name: "Show filters" });
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await open.click();
  await expect(page.getByRole("button", { name: "Hide filters" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Uploader rig", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hide filters" }).click();
  await expect(page.getByRole("button", { name: "Show filters" })).toBeVisible();
});

test("anonymous upload explains sign-in and avoids exposing an incomplete form", async ({ page }) => {
  await page.goto("/upload");
  await expect(page.getByRole("heading", { name: /Sign in with Discord to share a setup/ })).toBeVisible();
  await expect(page.getByText(/Browsing stays open to everyone/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Share Setup/ })).toHaveCount(0);
});

test("Help explains trust and offers direct navigation", async ({ page }) => {
  await page.goto("/help");
  await expect(page.getByRole("heading", { name: "Help using SetupSheet" })).toBeVisible();
  await expect(page.getByText(/not independent verification by SetupSheet/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Request a setup" })).toHaveAttribute("href", "/requests");
});
