import { describe, expect, it } from "vitest";

import { getBadgeTier } from "@/lib/badges";

describe("getBadgeTier", () => {
  it("returns null below the lowest threshold", () => {
    expect(getBadgeTier(0)).toBeNull();
    expect(getBadgeTier(9)).toBeNull();
  });

  it("returns Bronze at the lower boundary and just below Silver", () => {
    expect(getBadgeTier(10)?.name).toBe("Bronze Contributor");
    expect(getBadgeTier(49)?.name).toBe("Bronze Contributor");
  });

  it("returns Silver at its boundary and just below Gold", () => {
    expect(getBadgeTier(50)?.name).toBe("Silver Contributor");
    expect(getBadgeTier(199)?.name).toBe("Silver Contributor");
  });

  it("returns Gold at its boundary and above", () => {
    expect(getBadgeTier(200)?.name).toBe("Gold Contributor");
    expect(getBadgeTier(10000)?.name).toBe("Gold Contributor");
  });
});
