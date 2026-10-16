import { describe, expect, it } from "vitest";

import {
  bayesianAverage,
  compareByEvidence,
  evidenceLabel,
  formatRatingCount,
  formatScore,
  ratingTier,
} from "@/lib/ratings";

describe("formatScore", () => {
  it("prints 0-5 with one decimal, always", () => {
    expect(formatScore(4)).toBe("4.0");
    expect(formatScore(4.25)).toBe("4.3");
    expect(formatScore(0)).toBe("0.0");
  });

  it("clamps out-of-range and non-finite input instead of printing garbage", () => {
    expect(formatScore(7)).toBe("5.0");
    expect(formatScore(-1)).toBe("0.0");
    expect(formatScore(Number.NaN)).toBe("0.0");
  });
});

describe("formatRatingCount", () => {
  it("uses singular and plural correctly", () => {
    expect(formatRatingCount(0)).toBe("0 ratings");
    expect(formatRatingCount(1)).toBe("1 rating");
    expect(formatRatingCount(3)).toBe("3 ratings");
  });
});

describe("ratingTier", () => {
  it("maps evidence volume to Unrated / Early / established", () => {
    expect(ratingTier(0)).toBe("unrated");
    expect(ratingTier(1)).toBe("early");
    expect(ratingTier(4)).toBe("early");
    expect(ratingTier(5)).toBe("established");
    expect(ratingTier(50)).toBe("established");
  });

  it("treats missing counts as unrated", () => {
    expect(ratingTier(Number.NaN)).toBe("unrated");
    expect(ratingTier(-2)).toBe("unrated");
  });
});

describe("evidenceLabel", () => {
  it("follows the detail-page copy rules", () => {
    expect(evidenceLabel(0)).toBe("Unrated");
    expect(evidenceLabel(1)).toBe("Early · 1 rating");
    expect(evidenceLabel(4)).toBe("Early · 4 ratings");
    // At 5+ the word "Early" is dropped.
    expect(evidenceLabel(5)).toBe("5 ratings");
    expect(evidenceLabel(12)).toBe("12 ratings");
  });
});

describe("bayesianAverage", () => {
  it("shrinks a lone perfect rating toward the global mean — it is not a consensus", () => {
    // Raw average would present 5.0; Bayesian presents 4.0 at m=3.8.
    const lonePerfect = bayesianAverage(5, 1, 3.8);
    expect(lonePerfect).toBeLessThan(5);
    expect(lonePerfect).toBeCloseTo((5 * 3.8 + 5) / 6, 5);
    expect(bayesianAverage(5, 20, 3.8)).toBeLessThan(lonePerfect);
  });

  it("pulls low-evidence scores toward the global mean", () => {
    // One 5.0 rating with m=3.5, C=5 -> (5*3.5 + 5) / 6 = 3.83...
    const score = bayesianAverage(5, 1, 3.5);
    expect(score).toBeCloseTo((5 * 3.5 + 5) / 6, 5);
    expect(score).toBeLessThan(4.5);
  });

  it("converges to the raw average as evidence grows", () => {
    const score = bayesianAverage(4.2 * 500, 500, 3.5);
    expect(score).toBeCloseTo(4.2, 1);
  });

  it("returns the global mean when nothing is rated", () => {
    expect(bayesianAverage(0, 0, 3.5)).toBe(3.5);
    expect(bayesianAverage(Number.NaN, 3, 3.5)).toBe(3.5);
    expect(bayesianAverage(10, 2, Number.NaN)).toBe(0);
  });
});

describe("compareByEvidence", () => {
  it("a single 4.0 never outranks many 3.8s — at any global mean", () => {
    for (const mean of [2.5, 3.5, 3.8, 4.0, 4.5]) {
      const lone = { ratingCount: 1, score: 4.0 };
      const many = { ratingCount: 20, score: 3.8 };
      // Positive = `many` sorts first.
      expect(compareByEvidence(lone, many, mean)).toBeGreaterThan(0);
    }
  });

  it("with comparable evidence, the higher Bayesian score wins", () => {
    const a = { ratingCount: 10, score: 4.2 };
    const b = { ratingCount: 10, score: 3.9 };
    expect(compareByEvidence(a, b, 3.5)).toBeLessThan(0);
    expect(compareByEvidence(b, a, 3.5)).toBeGreaterThan(0);
    expect(compareByEvidence(a, a, 3.5)).toBe(0);
  });
});
