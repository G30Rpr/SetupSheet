/**
 * Trust-layer math and shared copy for the Pace / Predictability scores.
 *
 * One format everywhere in the UI: a 0-5 score to one decimal plus its
 * rating count ("4.0", "3 ratings") — never stars-as-percentages, never a
 * bare percentage. Ranking that leans on scores should use
 * {@link bayesianAverage} so a lone 5.0 cannot outrank a well-evidenced 3.8.
 */

/**
 * Bayesian prior strength C: how many "prior" ratings the global mean is
 * worth. C = 5 means one 5.0 rating pulls a score to (5*m + 5)/(5+1) ≈ m+0.8
 * — visible, but nowhere near a consensus. Configurable per call site; if we
 * ever need to tune it live it belongs in an `app_settings` row, not here.
 */
export const BAYESIAN_C = 5;

/**
 * Bayesian average: (C*m + sum) / (C + n) where m is the global mean and n
 * is the rating count behind `sum`. With no ratings the score is exactly the
 * global mean — the honest answer to "how good is this, really?" before
 * anyone has run it.
 */
export function bayesianAverage(
  sum: number,
  n: number,
  globalMean: number,
  C: number = BAYESIAN_C
): number {
  if (!Number.isFinite(globalMean)) return 0;
  if (!Number.isFinite(n) || n <= 0 || !Number.isFinite(sum)) return globalMean;
  if (!Number.isFinite(C) || C <= 0) return globalMean;
  return (C * globalMean + sum) / (C + n);
}

/** Clamp to 0-5 and print with one decimal: "4.0", "3.8", "0.0". */
export function formatScore(score: number): string {
  const safe = Number.isFinite(score) ? Math.min(Math.max(score, 0), 5) : 0;
  return safe.toFixed(1);
}

/** "1 rating" / "3 ratings" — always shown beside a score. */
export function formatRatingCount(ratingCount: number): string {
  const safe = Number.isFinite(ratingCount) && ratingCount > 0 ? Math.floor(ratingCount) : 0;
  return `${safe} ${safe === 1 ? "rating" : "ratings"}`;
}

export type RatingTier = "unrated" | "early" | "established";

/**
 * Evidence tiers: 0 ratings = Unrated, 1-4 = Early, 5+ = established (the
 * word "Early" is dropped at that point). A tier is about evidence volume,
 * not quality — a one-rating 5.0 is never presented as a consensus.
 */
export function ratingTier(ratingCount: number): RatingTier {
  const safe = Number.isFinite(ratingCount) ? Math.floor(ratingCount) : 0;
  if (safe <= 0) return "unrated";
  return safe < 5 ? "early" : "established";
}

/**
 * Evidence label for the detail page's "Who this is for" line:
 * "Unrated" | "Early · 1 rating" | "5 ratings".
 */
export function evidenceLabel(ratingCount: number): string {
  switch (ratingTier(ratingCount)) {
    case "unrated":
      return "Unrated";
    case "early":
      return `Early · ${formatRatingCount(ratingCount)}`;
    case "established":
      return formatRatingCount(ratingCount);
  }
}

/**
 * Rank comparator for surfacing setups against each other. Evidence first
 * (more ratings beat fewer), then the higher Bayesian score. This is what
 * makes the hard guarantee stick — "a setup with 1 rating never outranks
 * better-evidenced ones" — while {@link bayesianAverage} keeps score
 * comparisons honest between setups with comparable evidence. (Bayesian
 * shrinkage alone cannot promise that at every global mean; count-first
 * always can.)
 */
export function compareByEvidence(
  a: { ratingCount: number; score: number },
  b: { ratingCount: number; score: number },
  globalMean: number
): number {
  const countA = Math.max(0, Math.floor(a.ratingCount));
  const countB = Math.max(0, Math.floor(b.ratingCount));
  if (countA !== countB) return countB - countA;
  const scoreA = bayesianAverage(a.score * countA, countA, globalMean);
  const scoreB = bayesianAverage(b.score * countB, countB, globalMean);
  return scoreB - scoreA;
}

/** Tooltip copy — kept here so every surface defines the scores identically. */
export const PACE_DEFINITION = "Pace is how much lap time drivers think it finds.";
export const PREDICTABILITY_DEFINITION =
  "Predictability is whether it does the same thing next lap.";

/** The one-sentence definition shown under the two scores on the detail page. */
export const SCORE_DEFINITIONS_SENTENCE = `${PACE_DEFINITION} ${PREDICTABILITY_DEFINITION}`;
