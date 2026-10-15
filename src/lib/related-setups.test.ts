import { describe, expect, it } from "vitest";

import { pickRelatedSetups, type RelatedCandidate } from "@/lib/related-setups";

const self: RelatedCandidate = {
  id: "self",
  rigProfile: "Direct Drive + Load Cell",
  tags: ["Race", "Quali"],
};

function candidate(overrides: Partial<RelatedCandidate> & { id: string }): RelatedCandidate {
  return {
    rigProfile: "Direct Drive + Load Cell",
    tags: ["Race", "Quali"],
    ...overrides,
  };
}

describe("pickRelatedSetups", () => {
  it("keeps same-combo alternatives that differ in rig or style", () => {
    const picked = pickRelatedSetups(
      [
        candidate({ id: "other-rig", rigProfile: "Wheel + 3 Pedals" }),
        candidate({ id: "other-style", tags: ["Safe", "Beginner"] }),
      ],
      self
    );

    expect(picked.map((c) => c.id)).toEqual(["other-rig", "other-style"]);
  });

  it("ranks different-rig rows before style-only differences", () => {
    const picked = pickRelatedSetups(
      [
        candidate({ id: "style-only", tags: ["Safe"] }),
        candidate({ id: "rig-first", rigProfile: "Gamepad" }),
        candidate({ id: "style-only-2", tags: ["Aggressive"] }),
      ],
      self
    );

    expect(picked.map((c) => c.id)).toEqual(["rig-first", "style-only", "style-only-2"]);
  });

  it("never returns the setup being viewed or identical duplicates", () => {
    const picked = pickRelatedSetups(
      [
        self,
        candidate({ id: "duplicate" }), // same rig + same tags
      ],
      self
    );

    expect(picked).toEqual([]);
  });

  it("respects the limit after filtering", () => {
    const picked = pickRelatedSetups(
      Array.from({ length: 8 }, (_, i) => candidate({ id: `c${i}`, rigProfile: `Rig ${i}` })),
      self,
      3
    );

    expect(picked).toHaveLength(3);
    expect(picked.every((c) => c.rigProfile !== self.rigProfile)).toBe(true);
  });

  it("treats a tag-set difference in either direction as a style difference", () => {
    const picked = pickRelatedSetups(
      [
        candidate({ id: "fewer-tags", tags: ["Race"] }),
        candidate({ id: "more-tags", tags: ["Race", "Quali", "Beginner"] }),
      ],
      self
    );

    expect(picked.map((c) => c.id)).toEqual(["fewer-tags", "more-tags"]);
  });
});
