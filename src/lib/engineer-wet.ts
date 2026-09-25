import type { EngineerRecommendation } from "@/lib/engineer-types";

const PRESSURE_SYMPTOMS: ReadonlySet<string> = new Set([
  "hot-tyre-pressure-high",
  "hot-tyre-pressure-low",
]);

const WET_BASE_WARNING =
  "Wet grip and tyre behavior can change quickly. Make one small change, repeat the same test, and recheck the car after the tyres are stable.";

function addWarnings(
  existing: string[] | undefined,
  additions: readonly string[]
): string[] {
  return [...new Set([...(existing ?? []), ...additions])];
}

function isParameter(recommendation: EngineerRecommendation, expected: string): boolean {
  return recommendation.parameter.trim().toLocaleLowerCase() === expected.toLocaleLowerCase();
}

/**
 * Applies the explicit wet rules to cloned recommendations. The static source
 * objects are never edited, so a wet request cannot affect a later dry request.
 */
export function applyWetModifiers(
  symptomId: string,
  recommendations: readonly EngineerRecommendation[]
): EngineerRecommendation[] {
  const result: EngineerRecommendation[] = [];
  const brakeBiasWasBlocked =
    symptomId === "front-locking" && recommendations.some((item) => isParameter(item, "Brake bias"));

  for (const recommendation of recommendations) {
    // Without car-specific wet braking data, don't prescribe a balance shift
    // for a front-lock symptom in the wet. The ABS/static alternative remains.
    if (symptomId === "front-locking" && isParameter(recommendation, "Brake bias")) continue;

    const next: EngineerRecommendation = {
      ...recommendation,
      warnings: recommendation.warnings ? [...recommendation.warnings] : undefined,
    };
    const wetWarnings = [WET_BASE_WARNING];

    if (
      PRESSURE_SYMPTOMS.has(symptomId) &&
      recommendation.parameter.toLocaleLowerCase().includes("pressure") &&
      typeof recommendation.amount === "number"
    ) {
      // Pressure is a continuous value; keep the wet change at a tenth of a psi.
      next.amount = Math.round((recommendation.amount / 2) * 10) / 10;
      wetWarnings.push("Use the wet target for this car and compound; this smaller step is not an absolute pressure target.");
    }

    if (symptomId === "high-speed-instability" && isParameter(recommendation, "Rear wing")) {
      if (typeof recommendation.amount === "number") next.amount = recommendation.amount + 1;
      wetWarnings.push("The wet rule adds one rear-wing step for stability; confirm the drag and balance tradeoff.");
    }

    if (symptomId === "exit-wheelspin" && isParameter(recommendation, "Differential preload")) {
      if (recommendation.direction === "increase") next.direction = "decrease";
      else if (recommendation.direction === "decrease") next.direction = "increase";
      wetWarnings.push("Wet differential behavior is car-specific. Treat this direction as a one-step test and revert if wheelspin worsens.");
    }

    if (brakeBiasWasBlocked) {
      wetWarnings.push("Brake-bias advice is withheld for this wet front-lock symptom because axle balance is car- and grip-dependent.");
    }

    next.warnings = addWarnings(next.warnings, wetWarnings);
    result.push(next);
  }

  return result;
}
