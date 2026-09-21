import { describe, expect, it } from "vitest";

import { unresolvableIdSegment } from "@/lib/id-route-guard";

const UUID = "7ec21b4c-4a9b-4044-b2be-f6929af9be6a";

describe("unresolvableIdSegment", () => {
  it("flags non-uuid segments on the id routes that can only resolve for uuids", () => {
    expect(unresolvableIdSegment("/setups/not-a-uuid")).toBe("not-a-uuid");
    expect(unresolvableIdSegment("/setups/123")).toBe("123");
    expect(unresolvableIdSegment("/setups/not-a-uuid/edit")).toBe("not-a-uuid");
    expect(unresolvableIdSegment("/profile/not-a-uuid")).toBe("not-a-uuid");
    expect(unresolvableIdSegment("/setups/not-a-uuid/opengraph-image")).toBe("not-a-uuid");
  });

  it("leaves well-formed uuids alone, including trailing slashes", () => {
    expect(unresolvableIdSegment(`/setups/${UUID}`)).toBeNull();
    expect(unresolvableIdSegment(`/setups/${UUID}/`)).toBeNull();
    expect(unresolvableIdSegment(`/setups/${UUID}/edit`)).toBeNull();
    expect(unresolvableIdSegment(`/setups/${UUID}/opengraph-image`)).toBeNull();
    expect(unresolvableIdSegment(`/profile/${UUID}`)).toBeNull();
    expect(unresolvableIdSegment(`/profile/${UUID}/`)).toBeNull();
    expect(unresolvableIdSegment(`/profile/${UUID}/opengraph-image`)).toBeNull();
  });

  it("accepts a percent-encoded uuid, since the segment still decodes to one", () => {
    expect(unresolvableIdSegment(`/setups/${encodeURIComponent(UUID)}`)).toBeNull();
  });

  it("treats a malformed percent-escape as unresolvable instead of throwing", () => {
    expect(unresolvableIdSegment("/setups/%E0%A4%A")).toBe("%E0%A4%A");
    expect(unresolvableIdSegment("/profile/%")).toBe("%");
  });

  it("preserves static siblings of the dynamic segment", () => {
    // Regression: a naive shape guard would 404 the comparison page, which the
    // test below caught when the guard was first written.
    expect(unresolvableIdSegment("/setups/compare")).toBeNull();
    expect(unresolvableIdSegment("/setups/compare/")).toBeNull();
  });

  it("ignores every route that is not id-addressed", () => {
    for (const pathname of [
      "/",
      "/setups",
      "/setups/compare",
      "/setups/not-a-uuid/nested/deeper",
      "/profile",
      "/leaderboard",
      "/requests",
      "/upload",
      "/privacy",
      "/terms",
      "/community-guidelines",
      "/account/data-deletion",
      "/report",
      "/auth/callback",
      "/totally-bogus-page",
      "/opengraph-image",
      "/_next/static/chunks/a.js",
    ]) {
      expect(unresolvableIdSegment(pathname)).toBeNull();
    }
  });
});
