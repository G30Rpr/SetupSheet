import { describe, expect, it } from "vitest";

import { serializeSitemap } from "@/lib/sitemap-xml";

describe("serializeSitemap", () => {
  it("writes sitemap XML with escaped locations and normalized timestamps", () => {
    const xml = serializeSitemap([
      {
        url: "https://setupsheet.app/setups/a?x=1&y=<two>",
        lastModified: "2026-09-30T12:00:00Z",
        changeFrequency: "weekly",
        priority: 0.7,
      },
    ]);

    expect(xml).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    expect(xml).toContain("https://setupsheet.app/setups/a?x=1&amp;y=&lt;two&gt;");
    expect(xml).toContain("<lastmod>2026-09-30T12:00:00.000Z</lastmod>");
    expect(xml).toContain("<changefreq>weekly</changefreq>");
    expect(xml).toContain("<priority>0.7</priority>");
  });

  it("omits malformed last-modified dates", () => {
    const xml = serializeSitemap([{ url: "https://setupsheet.app/", lastModified: "not-a-date" }]);
    expect(xml).not.toContain("<lastmod>");
  });
});
