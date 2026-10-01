import { beforeEach, describe, expect, it, vi } from "vitest";

const { getProfileSitemapEntries, getSetupSitemapEntries } = vi.hoisted(() => ({
  getProfileSitemapEntries: vi.fn(),
  getSetupSitemapEntries: vi.fn(),
}));
vi.mock("@/lib/supabase/setups", () => ({ getProfileSitemapEntries, getSetupSitemapEntries }));

import { GET } from "@/app/sitemap.xml/route";

describe("GET /sitemap.xml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProfileSitemapEntries.mockResolvedValue([]);
    getSetupSitemapEntries.mockResolvedValue([]);
  });

  it("returns a public-cacheable XML sitemap on success", async () => {
    getSetupSitemapEntries.mockResolvedValue([
      { id: "11111111-1111-4111-8111-111111111111", updatedAt: "2026-09-30T12:00:00Z" },
    ]);

    const response = await GET();
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    expect(response.headers.get("cache-control")).toContain("s-maxage=3600");
    expect(xml).toContain("/setups/11111111-1111-4111-8111-111111111111");
  });

  it("returns a non-cacheable 503 instead of an empty sitemap on a database failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    getSetupSitemapEntries.mockRejectedValue(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("Sitemap temporarily unavailable.");
    log.mockRestore();
  });
});
