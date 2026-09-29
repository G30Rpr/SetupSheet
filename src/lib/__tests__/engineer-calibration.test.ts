import { describe, expect, it } from "vitest";

import { getEngineerRecommendations } from "@/lib/engineer";
import {
  applyPublicEngineerCalibration,
  betaCalibrationFactor,
  ENGINEER_CALIBRATION_MAX_FACTOR,
  ENGINEER_CALIBRATION_MIN_FACTOR,
  ENGINEER_CALIBRATION_MIN_SETUPS,
  mapPublicEngineerCalibrationRows,
} from "@/lib/engineer-calibration";
import type { EngineerCalibrationFactor, PublicEngineerCalibrationRow } from "@/lib/engineer-calibration";
import type { EngineerInput } from "@/lib/engineer-types";

const game = "Assetto Corsa Competizione" as const;

function aggregateRow(
  overrides: Partial<PublicEngineerCalibrationRow> = {}
): PublicEngineerCalibrationRow {
  return {
    game,
    condition: "Dry",
    parameter: "Rear anti-roll bar",
    direction: "stiffen",
    supporting_setup_count: ENGINEER_CALIBRATION_MIN_SETUPS,
    directions: ["stiffen"],
    ...overrides,
  };
}

function factor(overrides: Partial<EngineerCalibrationFactor> = {}): EngineerCalibrationFactor {
  return {
    game,
    condition: "dry",
    parameter: "Rear anti-roll bar",
    direction: "stiffen",
    sampleCount: ENGINEER_CALIBRATION_MIN_SETUPS,
    factor: 1.4,
    ...overrides,
  };
}

describe("public Engineer calibration", () => {
  it("uses the approved Beta(2,2) prior and bounded score-factor mapping", () => {
    expect(betaCalibrationFactor(0)).toBe(1);
    expect(betaCalibrationFactor(5)).toBeCloseTo(1.2222222222);
    expect(betaCalibrationFactor(1_000_000)).toBeLessThanOrEqual(ENGINEER_CALIBRATION_MAX_FACTOR);
    expect(betaCalibrationFactor(1_000_000)).toBeGreaterThan(1.3999);
    expect(betaCalibrationFactor(-1)).toBeNull();
    expect(betaCalibrationFactor(Number.POSITIVE_INFINITY)).toBeNull();
    expect(ENGINEER_CALIBRATION_MIN_FACTOR).toBe(0.6);
    expect(ENGINEER_CALIBRATION_MAX_FACTOR).toBe(1.4);
  });

  it("requires the minimum number of distinct public setups and exact game/condition", () => {
    const rows = [
      aggregateRow({ supporting_setup_count: ENGINEER_CALIBRATION_MIN_SETUPS - 1 }),
      aggregateRow({
        parameter: "Brake bias",
        direction: "decrease",
        directions: ["decrease"],
        supporting_setup_count: ENGINEER_CALIBRATION_MIN_SETUPS,
      }),
      aggregateRow({
        game: "Le Mans Ultimate",
        parameter: "Other game only",
        supporting_setup_count: ENGINEER_CALIBRATION_MIN_SETUPS,
      }),
      aggregateRow({
        condition: "Wet",
        parameter: "Other condition only",
        supporting_setup_count: ENGINEER_CALIBRATION_MIN_SETUPS,
      }),
    ];

    expect(mapPublicEngineerCalibrationRows(rows, game, "dry")).toEqual([
      expect.objectContaining({
        game,
        condition: "dry",
        parameter: "Brake bias",
        direction: "decrease",
        sampleCount: ENGINEER_CALIBRATION_MIN_SETUPS,
      }),
    ]);
    expect(mapPublicEngineerCalibrationRows(rows, "Gran Turismo 7", "dry")).toEqual([]);
    expect(mapPublicEngineerCalibrationRows(rows, game, "mixed")).toEqual([]);
  });

  it("rejects padded parameter names and contradictory directions", () => {
    const padded = mapPublicEngineerCalibrationRows(
      [aggregateRow({ parameter: " Rear anti-roll bar " })],
      game,
      "dry"
    );
    expect(padded).toEqual([]);

    const contradictory = mapPublicEngineerCalibrationRows(
      [
        aggregateRow({ directions: ["decrease", "stiffen"] }),
        aggregateRow({ direction: "decrease", directions: ["decrease", "stiffen"] }),
      ],
      game,
      "dry"
    );
    expect(contradictory).toEqual([]);
  });

  it("fails closed on malformed or duplicate aggregate rows", () => {
    expect(
      mapPublicEngineerCalibrationRows(
        [aggregateRow({ direction: "unknown" }), aggregateRow({ directions: [] }), null],
        game,
        "dry"
      )
    ).toEqual([]);
    expect(
      mapPublicEngineerCalibrationRows(
        [aggregateRow(), aggregateRow()],
        game,
        "dry"
      )
    ).toEqual([]);
  });

  it("changes ranking only, preserving static score, amount, warnings, and source objects", () => {
    const input: EngineerInput = {
      game,
      symptomId: "mid-corner-understeer",
      severity: "moderate",
      condition: "dry",
    };
    const staticResult = getEngineerRecommendations(input);
    const before = JSON.stringify(staticResult);
    const staticRearBar = staticResult.recommendations.find((item) => item.parameter === "Rear anti-roll bar");
    const calibration = factor();

    const calibrated = applyPublicEngineerCalibration(staticResult, input, [calibration]);

    expect(JSON.stringify(staticResult)).toBe(before);
    expect(calibrated.recommendations[0].parameter).toBe("Rear anti-roll bar");
    expect(calibrated.recommendations[0].score).toBe(staticRearBar?.score);
    expect(calibrated.recommendations[0].amount).toBe(staticRearBar?.amount);
    expect(calibrated.recommendations[0].publicEvidence).toEqual({ sampleCount: 5, factor: 1.4 });
    expect(calibrated.recommendations[0].warnings).toEqual(staticRearBar?.warnings);
    expect(calibrated.recommendations[1].publicEvidence).toBeUndefined();
  });

  it("does not apply wrong-condition, below-threshold, out-of-range, or duplicate factors", () => {
    const input: EngineerInput = {
      game,
      symptomId: "mid-corner-understeer",
      severity: "moderate",
      condition: "dry",
    };
    const staticResult = getEngineerRecommendations(input);
    const invalidFactors = [
      factor({ condition: "wet" }),
      factor({ sampleCount: ENGINEER_CALIBRATION_MIN_SETUPS - 1 }),
      factor({ factor: 2 }),
      factor(),
      factor(),
    ];
    const calibrated = applyPublicEngineerCalibration(staticResult, input, invalidFactors);

    expect(calibrated.recommendations.every((item) => item.publicEvidence === undefined)).toBe(true);
    expect(calibrated.recommendations.map((item) => item.parameter)).toEqual(
      staticResult.recommendations.map((item) => item.parameter)
    );
  });

  it("keeps wet behavior ahead of calibration and skips calibration without an exact condition", () => {
    const input: EngineerInput = {
      game,
      symptomId: "front-locking",
      severity: "moderate",
      condition: "wet",
    };
    const staticResult = getEngineerRecommendations(input);
    const dryEvidence = factor({ parameter: "ABS", direction: "increase", condition: "dry" });
    const wetEvidence = factor({ parameter: "ABS", direction: "increase", condition: "wet" });

    const calibrated = applyPublicEngineerCalibration(staticResult, input, [dryEvidence, wetEvidence]);

    expect(calibrated.recommendations.some((item) => item.parameter === "Brake bias")).toBe(false);
    expect(calibrated.recommendations.find((item) => item.parameter === "ABS")?.publicEvidence)
      .toEqual({ sampleCount: 5, factor: 1.4 });

    const withoutCondition = applyPublicEngineerCalibration(
      staticResult,
      { ...input, condition: undefined },
      [wetEvidence]
    );
    expect(withoutCondition).toBe(staticResult);
  });
});
