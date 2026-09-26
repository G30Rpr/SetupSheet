import { identifyRecommendationConflicts } from "@/lib/engineer";
import {
  ENGINEER_GAMES,
  type EngineerCondition,
  type EngineerDirection,
  type EngineerGame,
  type EngineerInput,
  type EngineerResult,
} from "@/lib/engineer-types";

export const ENGINEER_CALIBRATION_MIN_SETUPS = 5;
export const ENGINEER_CALIBRATION_STALENESS_DAYS = 90;
export const ENGINEER_CALIBRATION_BETA_ALPHA = 2;
export const ENGINEER_CALIBRATION_BETA_BETA = 2;
export const ENGINEER_CALIBRATION_MIN_FACTOR = 0.6;
export const ENGINEER_CALIBRATION_MAX_FACTOR = 1.4;

export interface EngineerCalibrationFactor {
  game: EngineerGame;
  condition: EngineerCondition;
  parameter: string;
  direction: EngineerDirection;
  sampleCount: number;
  factor: number;
}

export interface PublicEngineerCalibrationRow {
  game: string;
  condition: string;
  parameter: string;
  direction: string;
  supporting_setup_count: number;
  directions: string[];
}

export interface EngineerCalibrationQueryResult {
  status: "available" | "unavailable";
  factors: EngineerCalibrationFactor[];
}

const engineerDirections = new Set<EngineerDirection>([
  "increase",
  "decrease",
  "soften",
  "stiffen",
]);

function isEngineerGame(value: unknown): value is EngineerGame {
  return typeof value === "string" && ENGINEER_GAMES.includes(value as EngineerGame);
}

function isEngineerCondition(value: unknown): value is EngineerCondition {
  return value === "dry" || value === "wet";
}

function isEngineerDirection(value: unknown): value is EngineerDirection {
  return typeof value === "string" && engineerDirections.has(value as EngineerDirection);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Posterior-mean evidence multiplier with a Beta(2,2) prior. Public field-test
 * data contains positive, validated changes only, so this is intentionally a
 * support-only update; absent changes are never treated as failures.
 */
export function betaCalibrationFactor(supportingSetups: number): number | null {
  if (!Number.isSafeInteger(supportingSetups) || supportingSetups < 0) return null;

  const alpha = ENGINEER_CALIBRATION_BETA_ALPHA + supportingSetups;
  const beta = ENGINEER_CALIBRATION_BETA_BETA;
  const posteriorMean = alpha / (alpha + beta);
  const factor = 0.6 + 0.8 * posteriorMean;
  return Math.max(
    ENGINEER_CALIBRATION_MIN_FACTOR,
    Math.min(ENGINEER_CALIBRATION_MAX_FACTOR, factor)
  );
}

/**
 * Maps the privacy-safe SQL aggregate to exact, eligible parameter/direction
 * factors. A parameter is ignored if the evidence view reports more than one
 * direction or an inconsistent/duplicate aggregate row.
 */
export function mapPublicEngineerCalibrationRows(
  rows: readonly unknown[],
  gameValue: unknown,
  conditionValue: unknown
): EngineerCalibrationFactor[] {
  if (!isEngineerGame(gameValue) || !isEngineerCondition(conditionValue)) return [];

  const expectedCondition = conditionValue === "dry" ? "Dry" : "Wet";
  const groups = new Map<string, {
    invalid: boolean;
    seen: boolean;
    direction?: EngineerDirection;
    sampleCount?: number;
  }>();

  for (const value of rows) {
    if (!isRecord(value) || value.game !== gameValue || value.condition !== expectedCondition) continue;
    if (typeof value.parameter !== "string") continue;

    // Garage input is trimmed when recorded. Reject padded names here rather
    // than normalizing them; aliases, fuzzy, and case-folded matches are banned.
    const parameter = value.parameter;
    if (!parameter || parameter !== parameter.trim() || parameter.length > 120) continue;

    const group = groups.get(parameter) ?? { invalid: false, seen: false };
    groups.set(parameter, group);

    const rawDirections = value.directions;
    const direction = value.direction;
    const sampleCount = value.supporting_setup_count;

    if (
      !Array.isArray(rawDirections) ||
      rawDirections.length === 0 ||
      !rawDirections.every(isEngineerDirection) ||
      new Set(rawDirections).size !== rawDirections.length ||
      rawDirections.length !== 1 ||
      !isEngineerDirection(direction) ||
      rawDirections[0] !== direction ||
      typeof sampleCount !== "number" ||
      !Number.isSafeInteger(sampleCount) ||
      sampleCount < 1
    ) {
      group.invalid = true;
      continue;
    }

    if (group.seen) {
      group.invalid = true;
      continue;
    }

    group.seen = true;
    group.direction = direction;
    group.sampleCount = sampleCount;
  }

  const factors: EngineerCalibrationFactor[] = [];
  for (const [parameter, group] of groups) {
    const sampleCount = group.sampleCount;
    if (
      group.invalid ||
      !group.seen ||
      !group.direction ||
      !Number.isSafeInteger(sampleCount) ||
      (sampleCount as number) < ENGINEER_CALIBRATION_MIN_SETUPS
    ) {
      continue;
    }

    const factor = betaCalibrationFactor(sampleCount as number);
    if (factor === null) continue;
    factors.push({
      game: gameValue,
      condition: conditionValue,
      parameter,
      direction: group.direction,
      sampleCount: sampleCount as number,
      factor,
    });
  }

  return factors.sort((left, right) => left.parameter.localeCompare(right.parameter));
}

/**
 * Applies eligible public factors to cloned recommendations after static and
 * wet rules have run. Suggested amounts, explanations, warnings, and base
 * scores remain unchanged; only ordering is adjusted.
 */
export function applyPublicEngineerCalibration(
  result: EngineerResult,
  input: EngineerInput,
  factors: readonly EngineerCalibrationFactor[]
): EngineerResult {
  if (
    result.recommendations.length === 0 ||
    !isEngineerGame(input.game) ||
    !isEngineerCondition(input.condition) ||
    factors.length === 0
  ) {
    return result;
  }

  const factorByRule = new Map<string, EngineerCalibrationFactor>();
  const duplicateKeys = new Set<string>();

  for (const evidence of factors) {
    if (
      evidence.game !== input.game ||
      evidence.condition !== input.condition ||
      !evidence.parameter ||
      !isEngineerDirection(evidence.direction) ||
      !Number.isSafeInteger(evidence.sampleCount) ||
      evidence.sampleCount < ENGINEER_CALIBRATION_MIN_SETUPS ||
      !Number.isFinite(evidence.factor) ||
      evidence.factor < ENGINEER_CALIBRATION_MIN_FACTOR ||
      evidence.factor > ENGINEER_CALIBRATION_MAX_FACTOR
    ) {
      continue;
    }

    const key = `${evidence.parameter}\u0000${evidence.direction}`;
    if (factorByRule.has(key)) {
      duplicateKeys.add(key);
    } else {
      factorByRule.set(key, evidence);
    }
  }

  const ranked = result.recommendations.map((recommendation, index) => {
    const baseline = { ...recommendation, publicEvidence: undefined };
    const key = `${recommendation.parameter}\u0000${recommendation.direction}`;
    const evidence = duplicateKeys.has(key) ? undefined : factorByRule.get(key);
    const rankingFactor = evidence?.factor ?? 1;
    return {
      index,
      adjustedScore: recommendation.score * rankingFactor,
      recommendation: {
        ...baseline,
        warnings: baseline.warnings ? [...baseline.warnings] : undefined,
        ...(evidence
          ? { publicEvidence: { sampleCount: evidence.sampleCount, factor: evidence.factor } }
          : {}),
      },
    };
  });

  ranked.sort((left, right) =>
    right.adjustedScore - left.adjustedScore ||
    right.recommendation.score - left.recommendation.score ||
    left.index - right.index
  );

  const recommendations = ranked.map(({ recommendation }) => recommendation);
  return {
    ...result,
    recommendations,
    conflicts: identifyRecommendationConflicts(recommendations),
  };
}
