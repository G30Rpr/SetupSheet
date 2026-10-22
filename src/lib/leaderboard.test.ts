import { describe, expect, it } from "vitest";

import { isLeaderboardReady, leaderboardMode } from "@/lib/leaderboard";

describe("leaderboardMode", () => {
  it("reads as impact once anyone has laps driven by others or a field-tested setup", () => {
    expect(
      leaderboardMode([
        { lapsDrivenByOthers: 0, fieldTestedSetupCount: 0 },
        { lapsDrivenByOthers: 3, fieldTestedSetupCount: 0 },
      ])
    ).toBe("impact");
    expect(
      leaderboardMode([
        { lapsDrivenByOthers: 0, fieldTestedSetupCount: 1 },
        { lapsDrivenByOthers: 0, fieldTestedSetupCount: 0 },
      ])
    ).toBe("impact");
  });

  it("falls back to upvotes framing when no impact exists anywhere", () => {
    expect(
      leaderboardMode([
        { lapsDrivenByOthers: 0, fieldTestedSetupCount: 0 },
        { lapsDrivenByOthers: 0, fieldTestedSetupCount: 0 },
      ])
    ).toBe("upvotes");
    expect(leaderboardMode([])).toBe("upvotes");
  });
});

describe("isLeaderboardReady", () => {
  it("needs at least two contributors before calling it a ranking", () => {
    expect(isLeaderboardReady(2)).toBe(true);
    expect(isLeaderboardReady(1)).toBe(false);
    expect(isLeaderboardReady(0)).toBe(false);
  });
});
