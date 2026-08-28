import { describe, expect, it } from "vitest";

import { fullPageTitle, serializeJsonLd, truncateMetaDescription } from "@/lib/seo";

describe("SEO helpers", () => {
  it("normalizes and bounds meta descriptions without cutting a word when possible", () => {
    expect(truncateMetaDescription("  A   useful   setup  ")).toBe("A useful setup");

    const result = truncateMetaDescription("A setup description with enough words to require a safe truncation.", 36);
    expect(result.length).toBeLessThanOrEqual(36);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toMatch(/\s…$/);
  });

  it("formats canonical page titles", () => {
    expect(fullPageTitle("Browse Setups")).toBe("Browse Setups — SetupSheet");
  });

  it("escapes HTML-significant characters inside JSON-LD", () => {
    const serialized = serializeJsonLd({ description: '</script><script>alert("x")</script> & more' });
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(JSON.parse(serialized).description).toContain("</script>");
  });
});
