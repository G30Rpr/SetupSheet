import { expect, test } from "@playwright/test";

async function readJsonLd(
  page: import("@playwright/test").Page,
  matches: (data: Record<string, unknown>) => boolean = () => true
) {
  const scripts = page.locator('script[type="application/ld+json"]');
  for (let index = 0; index < await scripts.count(); index += 1) {
    const raw = await scripts.nth(index).textContent();
    const data = JSON.parse(raw ?? "null") as Record<string, unknown>;
    if (matches(data)) return data;
  }
  throw new Error("No matching JSON-LD script found");
}

test("landing page exposes canonical metadata and site structured data", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Free Community Sim Racing Setups — SetupSheet");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://setupsheet.app");

  const jsonLd = await readJsonLd(page);
  expect(jsonLd["@context"]).toBe("https://schema.org");
  expect(Array.isArray(jsonLd["@graph"])).toBe(true);
  expect(JSON.stringify(jsonLd)).toContain("SearchAction");
});

test("browse page exposes collection structured data and a results heading", async ({ page }) => {
  await page.goto("/setups");

  await expect(page.getByRole("heading", { level: 1, name: "Browse Setups" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Setup results" })).toBeAttached();

  const jsonLd = await readJsonLd(page, (data) => data["@type"] === "CollectionPage");
  expect(jsonLd["@type"]).toBe("CollectionPage");
  expect(JSON.stringify(jsonLd)).toContain("ItemList");
});

test("robots and sitemap endpoints advertise crawl configuration", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  const robotsText = await robots.text();
  expect(robotsText).toContain("Sitemap: https://setupsheet.app/sitemap.xml");
  expect(robotsText).toContain("Disallow: /auth/");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(sitemap.headers()["content-type"]).toContain("application/xml");
  expect(await sitemap.text()).toContain("https://setupsheet.app/setups");
});
