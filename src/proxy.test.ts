import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/lib/supabase/proxy", () => ({ updateSession }));

const { proxy } = await import("@/proxy");

describe("proxy malformed-ID response", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    "https://setupsheet.app/setups/not-a-uuid",
    "https://setupsheet.app/profile/not-a-uuid",
    "https://setupsheet.app/setups/not-a-uuid/edit",
  ])("returns a useful, non-cacheable 404 for %s", async (url) => {
    const response = await proxy(new NextRequest(url));

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    const html = await response.text();
    expect(html).toContain("We couldn’t find that page");
    expect(html).toContain('href="/setups"');
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("keeps malformed social-image URLs as bodyless 404s", async () => {
    const response = await proxy(
      new NextRequest("https://setupsheet.app/setups/not-a-uuid/opengraph-image")
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(updateSession).not.toHaveBeenCalled();
  });
});
