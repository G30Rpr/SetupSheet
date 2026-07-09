import { describe, expect, it } from "vitest";

import { isKnownOption, type SelectOptionGroup } from "@/lib/select-options";

describe("isKnownOption", () => {
  it("returns false when groups is undefined", () => {
    expect(isKnownOption(undefined, "anything")).toBe(false);
  });

  it("returns false for an empty groups array", () => {
    expect(isKnownOption([], "anything")).toBe(false);
  });

  it("finds a value present in any group", () => {
    const groups: SelectOptionGroup[] = [
      { label: "GT3", options: ["BMW M4 GT3", "Ferrari 296 GT3"] },
      { label: "GT4", options: ["Alpine A110 GT4"] },
    ];
    expect(isKnownOption(groups, "Alpine A110 GT4")).toBe(true);
    expect(isKnownOption(groups, "BMW M4 GT3")).toBe(true);
  });

  it("returns false for a value absent from every group", () => {
    const groups: SelectOptionGroup[] = [{ label: "GT3", options: ["BMW M4 GT3"] }];
    expect(isKnownOption(groups, "Something Else")).toBe(false);
  });
});
