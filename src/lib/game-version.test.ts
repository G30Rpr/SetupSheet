import { describe, expect, it } from "vitest";

import { gameVersionState } from "@/lib/game-version";

describe("gameVersionState", () => {
  it("reports nothing when the author reported no version", () => {
    expect(gameVersionState(null, null)).toEqual({ kind: "unreported" });
    expect(gameVersionState(undefined, "1.6")).toEqual({ kind: "unreported" });
    expect(gameVersionState("   ", "1.6")).toEqual({ kind: "unreported" });
  });

  it("shows a reported version plainly when the current patch is unknown", () => {
    expect(gameVersionState("1.6", null)).toEqual({ kind: "reported", version: "1.6" });
    expect(gameVersionState(" 1.6 ", "")).toEqual({ kind: "reported", version: "1.6" });
    expect(gameVersionState("LMU 1.6.2", "  ")).toEqual({
      kind: "reported",
      version: "LMU 1.6.2",
    });
  });

  it("marks exact matches current -- no guessed version semantics", () => {
    expect(gameVersionState("1.6", "1.6")).toEqual({ kind: "current", version: "1.6" });
    expect(gameVersionState(" 1.6", "1.6 ")).toEqual({ kind: "current", version: "1.6" });
    expect(gameVersionState("1.6.0", "1.6")).toEqual({
      kind: "stale",
      version: "1.6.0",
      currentVersion: "1.6",
    });
  });

  it("marks differing versions stale and keeps both strings", () => {
    expect(gameVersionState("1.5", "1.6")).toEqual({
      kind: "stale",
      version: "1.5",
      currentVersion: "1.6",
    });
  });
});
