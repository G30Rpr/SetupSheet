import { describe, expect, it } from "vitest";

import { isUuid } from "@/lib/utils";
import { setupOgImageSegment } from "@/lib/setup-og-image-path";

const UUID = "89847bbd-95e6-4ead-84fc-92baa0162600";

describe("setupOgImageSegment", () => {
  it("extracts the id segment of a setup OG-image request", () => {
    expect(setupOgImageSegment(`/setups/${UUID}/opengraph-image`)).toBe(UUID);
    expect(setupOgImageSegment(`/setups/${UUID}/opengraph-image/`)).toBe(UUID);
  });

  it("returns null for every other route", () => {
    expect(setupOgImageSegment("/setups")).toBeNull();
    expect(setupOgImageSegment(`/setups/${UUID}`)).toBeNull();
    expect(setupOgImageSegment(`/setups/${UUID}/edit`)).toBeNull();
    expect(setupOgImageSegment("/opengraph-image")).toBeNull();
    expect(setupOgImageSegment("/profile/not-a-uuid/opengraph-image")).toBeNull();
  });

  it("lets the middleware reject junk ids without rendering them", () => {
    // The guard is "segment present but not a UUID". Both halves matter: a junk
    // id must be refused, and a real one must never be, or the card images for
    // shared setups stop working.
    expect(isUuid(setupOgImageSegment("/setups/not-a-uuid/opengraph-image") ?? "")).toBe(false);
    expect(isUuid(setupOgImageSegment(`/setups/${UUID}/opengraph-image`) ?? "")).toBe(true);
  });

  it("does not treat a nested path as an OG request", () => {
    expect(setupOgImageSegment("/setups/a/b/opengraph-image")).toBeNull();
  });
});
