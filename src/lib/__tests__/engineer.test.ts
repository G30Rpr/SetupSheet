import { describe, expect, it, vi } from "vitest";

import {
  ENGINEER_GAMES,
  ENGINEER_SYMPTOMS,
  getEngineerRecommendations,
  identifyRecommendationConflicts,
  type EngineerRecommendation,
} from "@/lib/engineer";

function recommendation(
  parameter: string,
  direction: EngineerRecommendation["direction"]
): EngineerRecommendation {
  return {
    parameter,
    direction,
    amount: 1,
    score: 80,
    explanation: "Test recommendation",
  };
}

describe("static Engineer recommendations", () => {
  it("returns at least one recommendation for every symptom in both reviewed games", () => {
    for (const game of ENGINEER_GAMES) {
      for (const symptom of ENGINEER_SYMPTOMS) {
        const result = getEngineerRecommendations({
          game,
          symptomId: symptom.id,
          severity: "moderate",
          condition: "dry",
        });

        expect(result.status, `${game}: ${symptom.id}`).toBe("ready");
        expect(result.recommendations.length, `${game}: ${symptom.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("changes suggested amount with severity", () => {
    const amounts = (["slight", "moderate", "severe"] as const).map((severity) =>
      getEngineerRecommendations({
        game: "Assetto Corsa Competizione",
        symptomId: "hot-tyre-pressure-high",
        severity,
        condition: "dry",
      }).recommendations[0].amount
    );

    expect(amounts).toEqual([0.2, 0.4, 0.6]);
    expect(new Set(amounts).size).toBe(3);
  });

  it("identifies opposite recommendations for the same parameter", () => {
    const conflicts = identifyRecommendationConflicts([
      recommendation("Rear wing", "increase"),
      recommendation(" rear WING ", "decrease"),
      recommendation("Front anti-roll bar", "soften"),
      recommendation("Front anti-roll bar", "stiffen"),
      recommendation("ABS", "increase"),
    ]);

    expect(conflicts).toHaveLength(2);
    expect(conflicts.map((conflict) => conflict.parameter)).toEqual([
      "Rear wing",
      "Front anti-roll bar",
    ]);
    expect(conflicts[0].recommendationIndices).toEqual([0, 1]);
  });

  it("keeps wet modifiers immutable and applies the documented wet behaviors", () => {
    const input = {
      game: "Assetto Corsa Competizione",
      symptomId: "exit-wheelspin",
      severity: "moderate",
      condition: "dry",
    } as const;
    const dryBefore = getEngineerRecommendations(input).recommendations;
    const frozenSnapshot = JSON.stringify(dryBefore);

    const wetWheelspin = getEngineerRecommendations({ ...input, condition: "wet" });
    const dryAfter = getEngineerRecommendations(input).recommendations;
    const dryDiff = dryBefore.find((item) => item.parameter === "Differential preload");
    const wetDiff = wetWheelspin.recommendations.find((item) => item.parameter === "Differential preload");

    expect(JSON.stringify(dryBefore)).toBe(frozenSnapshot);
    expect(dryAfter).toEqual(dryBefore);
    expect(dryDiff?.direction).toBe("increase");
    expect(wetDiff?.direction).toBe("decrease");
    expect(wetDiff?.warnings?.some((warning) => /wet differential/i.test(warning))).toBe(true);
    expect(wetWheelspin.recommendations).not.toBe(dryBefore);

    const wetPressure = getEngineerRecommendations({
      game: "Le Mans Ultimate",
      symptomId: "hot-tyre-pressure-high",
      severity: "moderate",
      condition: "wet",
    });
    expect(wetPressure.recommendations[0].amount).toBe(0.2);

    const wetWing = getEngineerRecommendations({
      game: "Assetto Corsa Competizione",
      symptomId: "high-speed-instability",
      severity: "moderate",
      condition: "wet",
    });
    expect(wetWing.recommendations[0].amount).toBe(3);
    expect(wetWing.recommendations[0].warnings?.some((warning) => /rear-wing step/i.test(warning))).toBe(true);

    const wetBraking = getEngineerRecommendations({
      game: "Assetto Corsa Competizione",
      symptomId: "front-locking",
      severity: "moderate",
      condition: "wet",
    });
    expect(wetBraking.recommendations.some((item) => item.parameter === "Brake bias")).toBe(false);
    expect(wetBraking.recommendations.some((item) => item.parameter === "ABS")).toBe(true);
    expect(wetBraking.recommendations[0].warnings?.some((warning) => /withheld/i.test(warning))).toBe(true);
  });

  it("suppresses pressure advice for GT7 until a reviewed mapping exists", () => {
    const result = getEngineerRecommendations({
      game: "Gran Turismo 7",
      symptomId: "hot-tyre-pressure-high",
      severity: "moderate",
      condition: "dry",
    });

    expect(result.recommendations.some((item) => item.parameter.toLowerCase().includes("pressure"))).toBe(false);
    expect(result.notices.join(" ")).toMatch(/pressure advice is unavailable/i);
  });

  it("fails safely for an unknown symptom ID", () => {
    const result = getEngineerRecommendations({
      game: "Assetto Corsa Competizione",
      symptomId: "not-a-known-symptom",
      severity: "severe",
    });

    expect(result.status).toBe("unknown-symptom");
    expect(result.symptom).toBeNull();
    expect(result.recommendations).toEqual([]);
    expect(result.notices).not.toHaveLength(0);
  });

  it("returns the static fallback without making a database or network request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = getEngineerRecommendations({
        game: "Le Mans Ultimate",
        symptomId: "exit-oversteer",
        severity: "moderate",
      });

      expect(result.source).toBe("static");
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps static recommendations when the game is omitted or unrecognized", () => {
    const withoutGame = getEngineerRecommendations({
      symptomId: "front-locking",
      severity: "moderate",
    });
    const withUnknownGame = getEngineerRecommendations({
      game: "Unknown Sim",
      symptomId: "front-locking",
      severity: "moderate",
    });

    expect(withoutGame.status).toBe("generic");
    expect(withoutGame.recommendations.length).toBeGreaterThan(0);
    expect(withUnknownGame.status).toBe("generic");
    expect(withUnknownGame.recommendations.length).toBeGreaterThan(0);
  });
});
