import { describe, expect, it } from "vitest";

import { getInitials } from "@/lib/utils";

describe("getInitials", () => {
  it("takes the first letter of the first two words, uppercased", () => {
    expect(getInitials("John Doe")).toBe("JD");
    expect(getInitials("john doe")).toBe("JD");
  });

  it("returns a single letter for a single word", () => {
    expect(getInitials("Racer")).toBe("R");
  });

  it("ignores words beyond the first two", () => {
    expect(getInitials("John Middle Doe")).toBe("JM");
  });

  it("characterizes current (unhardened) behavior on empty/whitespace input", () => {
    expect(getInitials("")).toBe("");
    // A leading space produces an empty first "word", whose first
    // character is undefined -- current behavior, not a fixed contract.
    expect(getInitials(" John")).toBe("J");
  });
});
