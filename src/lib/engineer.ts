import { applyWetModifiers } from "@/lib/engineer-wet";
import {
  ENGINEER_GAMES,
  ENGINEER_SEVERITIES,
  ENGINEER_SYMPTOMS,
  type EngineerGame,
  type EngineerInput,
  type EngineerRecommendation,
  type EngineerRecommendationConflict,
  type EngineerResult,
  type EngineerSeverity,
  type EngineerSymptomId,
} from "@/lib/engineer-types";

export {
  ENGINEER_GAMES,
  ENGINEER_SEVERITIES,
  ENGINEER_SYMPTOMS,
} from "@/lib/engineer-types";
export type {
  EngineerCondition,
  EngineerDirection,
  EngineerGame,
  EngineerInput,
  EngineerRecommendation,
  EngineerRecommendationConflict,
  EngineerResult,
  EngineerSeverity,
  EngineerSymptom,
  EngineerSymptomId,
} from "@/lib/engineer-types";

 type AmountBySeverity = Readonly<Record<EngineerSeverity, number | string>>;

type StaticRecommendationRule = Omit<EngineerRecommendation, "amount"> & {
  amounts: AmountBySeverity;
};

type SymptomRules = Record<EngineerSymptomId, readonly StaticRecommendationRule[]>;

type GameRuleOptions = {
  tractionControlParameter: string;
  differentialPreloadUnit: string;
  differentialPreloadAmounts: AmountBySeverity;
};

const pressureAdjustmentAmounts = { slight: 0.2, moderate: 0.4, severe: 0.6 } as const;
const smallSetupStepAmounts = { slight: 1, moderate: 2, severe: 3 } as const;

function makeRule(
  parameter: string,
  direction: EngineerRecommendation["direction"],
  amounts: AmountBySeverity,
  unit: string | undefined,
  score: number,
  explanation: string,
  warnings: string[] = []
): StaticRecommendationRule {
  return { parameter, direction, amounts, ...(unit ? { unit } : {}), score, explanation, warnings };
}

function createGameRules({
  tractionControlParameter,
  differentialPreloadUnit,
  differentialPreloadAmounts,
}: GameRuleOptions): SymptomRules {
  return {
    "front-locking": [
      makeRule(
        "Brake bias",
        "decrease",
        { slight: 0.2, moderate: 0.4, severe: 0.6 },
        "% front",
        96,
        "Move the balance slightly rearward to reduce the braking demand on the front tyres. Recheck rear stability under the same braking conditions.",
        ["Make small changes and confirm the rear remains stable during trail braking."]
      ),
      makeRule(
        "ABS",
        "increase",
        { slight: 1, moderate: 2, severe: 3 },
        "level(s)",
        82,
        "A small increase in ABS assistance can help prevent a tyre from locking. More intervention may change braking feel and stopping distance.",
        ["Change one control at a time so you can tell which adjustment helped."]
      ),
    ],
    "mid-corner-understeer": [
      makeRule(
        "Front anti-roll bar",
        "soften",
        smallSetupStepAmounts,
        "click(s)",
        94,
        "A softer front anti-roll bar can let the front axle keep more mechanical grip through a steady-state corner.",
        ["Treat the front and rear anti-roll-bar suggestions as alternatives; try only one first."]
      ),
      makeRule(
        "Rear anti-roll bar",
        "stiffen",
        smallSetupStepAmounts,
        "click(s)",
        80,
        "A slightly stiffer rear anti-roll bar can help the car rotate, but too much may make the rear less settled over bumps or kerbs.",
        ["Treat the front and rear anti-roll-bar suggestions as alternatives; try only one first."]
      ),
    ],
    "mid-corner-oversteer": [
      makeRule(
        "Rear anti-roll bar",
        "soften",
        smallSetupStepAmounts,
        "click(s)",
        94,
        "A softer rear anti-roll bar can reduce the rear axle's contribution to mid-corner rotation.",
        ["Try one axle adjustment at a time and recheck kerb behavior."]
      ),
      makeRule(
        "Front anti-roll bar",
        "stiffen",
        smallSetupStepAmounts,
        "click(s)",
        80,
        "A small increase in front roll stiffness can shift balance away from rear rotation; it may add front push.",
        ["Treat the front and rear anti-roll-bar suggestions as alternatives; try only one first."]
      ),
    ],
    "exit-oversteer": [
      makeRule(
        tractionControlParameter,
        "increase",
        { slight: 1, moderate: 2, severe: 3 },
        "level(s)",
        96,
        "Increase traction-control intervention one step at a time to reduce power-on wheelspin and help the rear stay composed.",
        ["The meaning of a level can vary by car; verify that the selected control is available for your car."]
      ),
      makeRule(
        "Rear anti-roll bar",
        "soften",
        smallSetupStepAmounts,
        "click(s)",
        78,
        "A softer rear anti-roll bar can add rear mechanical grip as you apply throttle.",
        ["Change this only after testing the electronics adjustment on its own."]
      ),
    ],
    "exit-wheelspin": [
      makeRule(
        "Differential preload",
        "increase",
        differentialPreloadAmounts,
        differentialPreloadUnit,
        89,
        "A small preload increase can help the driven axle share drive when one tyre spins. Too much can add corner-exit understeer.",
        ["Differential behavior is car-specific; test one small step and revert if corner-exit push increases."]
      ),
      makeRule(
        tractionControlParameter,
        "increase",
        { slight: 1, moderate: 2, severe: 3 },
        "level(s)",
        84,
        "A small traction-control increase can limit wheelspin while you work on the mechanical balance.",
        ["Test this separately from the differential change."]
      ),
    ],
    "high-speed-instability": [
      makeRule(
        "Rear wing",
        "increase",
        smallSetupStepAmounts,
        "click(s)",
        93,
        "A little more rear aerodynamic load can improve high-speed stability, with a possible straight-line speed cost.",
        ["Check the top-speed tradeoff and avoid changing front and rear aero together."]
      ),
    ],
    "hot-tyre-pressure-high": [
      makeRule(
        "Tyre pressure on the affected corner",
        "decrease",
        pressureAdjustmentAmounts,
        "psi",
        92,
        "Reduce the affected tyre's hot pressure in a small step, then recheck it after a representative run.",
        ["Use the target for this car, compound, and game; this is an adjustment step, not a universal target pressure."]
      ),
    ],
    "hot-tyre-pressure-low": [
      makeRule(
        "Tyre pressure on the affected corner",
        "increase",
        pressureAdjustmentAmounts,
        "psi",
        92,
        "Increase the affected tyre's hot pressure in a small step, then recheck it after a representative run.",
        ["Use the target for this car, compound, and game; this is an adjustment step, not a universal target pressure."]
      ),
    ],
  };
}

const GAME_RULES: Record<EngineerGame, SymptomRules> = {
  "Assetto Corsa Competizione": createGameRules({
    tractionControlParameter: "Traction control (TC1)",
    differentialPreloadUnit: "Nm",
    differentialPreloadAmounts: { slight: 10, moderate: 20, severe: 30 },
  }),
  "Le Mans Ultimate": createGameRules({
    tractionControlParameter: "Onboard TC",
    differentialPreloadUnit: "step(s)",
    differentialPreloadAmounts: { slight: 1, moderate: 2, severe: 3 },
  }),
};

/**
 * General static advice for an omitted or not-yet-reviewed title. It deliberately
 * avoids game-specific pressure units and controls that may not exist in a game.
 */
const GENERIC_RULES: Partial<SymptomRules> = {
  "front-locking": [
    makeRule(
      "Brake balance",
      "decrease",
      { slight: 0.2, moderate: 0.4, severe: 0.6 },
      "% front",
      92,
      "Move the balance a small step away from the front axle and recheck rear stability under braking.",
      ["Confirm the title uses a front-bias scale before applying this adjustment."]
    ),
  ],
  "mid-corner-understeer": [
    makeRule(
      "Front anti-roll bar",
      "soften",
      smallSetupStepAmounts,
      "setup step(s)",
      90,
      "If the title exposes an adjustable front anti-roll bar, a small reduction can help front grip in a steady corner.",
      ["Confirm the control exists and change one setup item at a time."]
    ),
  ],
  "mid-corner-oversteer": [
    makeRule(
      "Rear anti-roll bar",
      "soften",
      smallSetupStepAmounts,
      "setup step(s)",
      90,
      "If the title exposes an adjustable rear anti-roll bar, a small reduction can calm mid-corner rotation.",
      ["Confirm the control exists and change one setup item at a time."]
    ),
  ],
  "exit-oversteer": [
    makeRule(
      "Traction control",
      "increase",
      { slight: 1, moderate: 2, severe: 3 },
      "level(s)",
      92,
      "If available, increase traction-control intervention one small step to reduce power-on wheelspin.",
      ["Control scales vary by title and car; confirm the direction in-game."]
    ),
  ],
  "exit-wheelspin": [
    makeRule(
      "Differential preload",
      "increase",
      smallSetupStepAmounts,
      "setup step(s)",
      86,
      "If the car has adjustable differential preload, test one small increase to help share drive across the axle.",
      ["This is car-specific; revert if it adds corner-exit understeer."]
    ),
  ],
  "high-speed-instability": [
    makeRule(
      "Rear aerodynamic load",
      "increase",
      smallSetupStepAmounts,
      "setup step(s)",
      90,
      "If adjustable, a small rear-aero increase can improve high-speed stability, with a possible drag cost.",
      ["Confirm the title and car expose this control before applying it."]
    ),
  ],
};

function resolveGame(game: string | undefined): EngineerGame | undefined {
  return ENGINEER_GAMES.find((candidate) => candidate === game);
}

function findSymptom(symptomId: string) {
  return ENGINEER_SYMPTOMS.find((symptom) => symptom.id === symptomId) ?? null;
}

function materializeRules(
  rules: readonly StaticRecommendationRule[] | undefined,
  severity: EngineerSeverity
): EngineerRecommendation[] {
  if (!rules) return [];

  return rules
    .map(({ amounts, ...rule }) => ({
      ...rule,
      amount: amounts[severity],
      warnings: rule.warnings ? [...rule.warnings] : undefined,
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Reads only the checked-in, deterministic knowledge base. This intentionally
 * has no Supabase, network, or browser dependency so it is always available.
 */
export function getStaticRecommendations(input: EngineerInput): EngineerRecommendation[] {
  const symptom = findSymptom(input.symptomId);
  if (!symptom) return [];

  const severity = ENGINEER_SEVERITIES.includes(input.severity)
    ? input.severity
    : "moderate";
  const game = resolveGame(input.game);
  const rules = game ? GAME_RULES[game][symptom.id] : GENERIC_RULES[symptom.id];
  return materializeRules(rules, severity);
}

const oppositeDirections: Partial<Record<EngineerRecommendation["direction"], EngineerRecommendation["direction"]>> = {
  increase: "decrease",
  decrease: "increase",
  soften: "stiffen",
  stiffen: "soften",
};

/** Finds recommendations that ask for opposite changes to the same parameter. */
export function identifyRecommendationConflicts(
  recommendations: readonly EngineerRecommendation[]
): EngineerRecommendationConflict[] {
  const grouped = new Map<string, { parameter: string; indices: number[] }>();

  recommendations.forEach((recommendation, index) => {
    const key = recommendation.parameter.trim().toLocaleLowerCase();
    if (!key) return;
    const entry = grouped.get(key) ?? { parameter: recommendation.parameter, indices: [] };
    entry.indices.push(index);
    grouped.set(key, entry);
  });

  const conflicts: EngineerRecommendationConflict[] = [];
  for (const { parameter, indices } of grouped.values()) {
    const conflictingIndices = new Set<number>();
    for (let left = 0; left < indices.length; left += 1) {
      for (let right = left + 1; right < indices.length; right += 1) {
        const leftIndex = indices[left];
        const rightIndex = indices[right];
        const leftDirection = recommendations[leftIndex].direction;
        const rightDirection = recommendations[rightIndex].direction;
        if (oppositeDirections[leftDirection] === rightDirection) {
          conflictingIndices.add(leftIndex);
          conflictingIndices.add(rightIndex);
        }
      }
    }

    if (conflictingIndices.size > 0) {
      const conflictIndices = [...conflictingIndices].sort((a, b) => a - b);
      const directions = [...new Set(conflictIndices.map((index) => recommendations[index].direction))];
      conflicts.push({
        parameter,
        recommendationIndices: conflictIndices,
        directions,
        message: `These suggestions disagree about ${parameter}. Apply only one direction after checking the setup.`,
      });
    }
  }

  return conflicts;
}

function hasKnownCondition(condition: unknown): condition is "dry" | "wet" | undefined {
  return condition === undefined || condition === "dry" || condition === "wet";
}

/**
 * Returns deterministic static recommendations. A future public-evidence layer
 * can wrap this function, but should never be required to produce its baseline.
 */
export function getEngineerRecommendations(input: EngineerInput): EngineerResult {
  const symptom = findSymptom(input.symptomId);
  if (!symptom) {
    return {
      status: "unknown-symptom",
      symptom: null,
      recommendations: [],
      conflicts: [],
      notices: ["That symptom is not in the reviewed list yet. Choose another symptom or send us the wording to review."],
      source: "static",
      gameSpecific: false,
    };
  }

  const game = resolveGame(input.game);
  const gameSpecific = Boolean(game);
  const recommendations = getStaticRecommendations(input);
  const notices: string[] = [];

  if (!gameSpecific) {
    notices.push(
      "Showing general static guidance because this title has no reviewed Engineer mapping yet. Confirm the control exists in-game before changing it."
    );
  }

  if (!hasKnownCondition(input.condition)) {
    notices.push("Condition is not recognized; wet adjustments are skipped and the static baseline is shown.");
  }

  let rankedRecommendations = recommendations;
  if (input.condition === "wet") {
    rankedRecommendations = applyWetModifiers(symptom.id, recommendations);
  } else {
    // Do not share recommendation objects with callers; downstream rendering or
    // future evidence overlays must not be able to mutate the static baseline.
    rankedRecommendations = recommendations.map((recommendation) => ({
      ...recommendation,
      warnings: recommendation.warnings ? [...recommendation.warnings] : undefined,
    }));
  }

  if (rankedRecommendations.length === 0) {
    if (symptom.id === "hot-tyre-pressure-high" || symptom.id === "hot-tyre-pressure-low") {
      notices.push(
        "Pressure advice is unavailable for this title until its tyre model and units are reviewed. No pressure change is suggested."
      );
    } else {
      notices.push("No static recommendation is available for this combination yet.");
    }
  }

  rankedRecommendations.sort((a, b) => b.score - a.score);
  const conflicts = identifyRecommendationConflicts(rankedRecommendations);

  return {
    status: rankedRecommendations.length === 0 ? "unavailable" : gameSpecific ? "ready" : "generic",
    symptom,
    recommendations: rankedRecommendations,
    conflicts,
    notices,
    source: "static",
    gameSpecific,
  };
}
