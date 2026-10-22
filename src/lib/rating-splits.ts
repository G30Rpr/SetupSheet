import type { RatingSplit } from "@/lib/types";

/**
 * "On a similar rig" vs "Everyone else" (P2 item 3). A setup's rating rows
 * arrive as per-rig aggregate buckets (see get_setup_rating_splits in
 * 0037_rater_rig.sql); this module merges those buckets against an anchor
 * rig so the detail page can show both rows. Pure and unit-tested — the
 * anchor choice (your saved rig, else the rig the setup is for) is
 * presentation and lives in the component.
 */

export interface ScoreTotals {
  paceSum: number;
  paceN: number;
  predSum: number;
  predN: number;
}

export const EMPTY_TOTALS: ScoreTotals = { paceSum: 0, paceN: 0, predSum: 0, predN: 0 };

export function mergeTotals(buckets: RatingSplit[]): ScoreTotals {
  return buckets.reduce<ScoreTotals>(
    (acc, b) => ({
      paceSum: acc.paceSum + b.paceSum,
      paceN: acc.paceN + b.paceN,
      predSum: acc.predSum + b.predSum,
      predN: acc.predN + b.predN,
    }),
    { ...EMPTY_TOTALS }
  );
}

/**
 * Buckets whose rig matches the anchor count as "on a similar rig"; every
 * other bucket — including ratings that didn't share a rig (null) — is
 * "everyone else". With no anchor, everything lands in everyone else.
 */
export function splitBySimilarRig(
  splits: RatingSplit[],
  anchorRig: string | null
): { similar: ScoreTotals; others: ScoreTotals } {
  const similarBuckets = anchorRig
    ? splits.filter((s) => s.rigProfile === anchorRig)
    : [];
  const otherBuckets = anchorRig
    ? splits.filter((s) => s.rigProfile !== anchorRig)
    : splits;
  return { similar: mergeTotals(similarBuckets), others: mergeTotals(otherBuckets) };
}

/** Mean predictability for one rig bucket — Best match's similar-rig tiebreak. Null when that rig hasn't rated. */
export function similarRigPredictability(
  splits: RatingSplit[] | undefined,
  rig: string | null
): number | null {
  if (!rig) return null;
  const bucket = (splits ?? []).find((s) => s.rigProfile === rig);
  if (!bucket || bucket.predN === 0) return null;
  return bucket.predSum / bucket.predN;
}

/**
 * Per-rig-type sub-scores (Phase 3 item 2c): a rig type's Pace and
 * Predictability means, shown only once that score has this many ratings
 * from that rig type. Below the floor the sample is too thin to read as
 * established, so the score is withheld (null) rather than displayed as a
 * shaky mean -- same honesty rule as "1-rating setups never look
 * established".
 */
export const MIN_RIG_SUBSCORE_N = 3;

export interface RigTypeScore {
  /** Named rig type; buckets of raters who didn't share a rig (null) are not a rig type. */
  rigProfile: string;
  /** Mean Pace at n >= MIN_RIG_SUBSCORE_N, else null (withheld). */
  pace: number | null;
  paceN: number;
  /** Mean Predictability at n >= MIN_RIG_SUBSCORE_N, else null (withheld). */
  predictability: number | null;
  predN: number;
}

/**
 * The per-rig-type rows worth rendering: named rig types where at least one
 * score clears MIN_RIG_SUBSCORE_N, strongest evidence first (then name) so
 * the order is stable and never hype-sorted.
 */
export function rigTypeSubScores(splits: RatingSplit[]): RigTypeScore[] {
  const rows: RigTypeScore[] = [];
  for (const s of splits) {
    if (!s.rigProfile) continue;
    const pace = s.paceN >= MIN_RIG_SUBSCORE_N ? s.paceSum / s.paceN : null;
    const predictability = s.predN >= MIN_RIG_SUBSCORE_N ? s.predSum / s.predN : null;
    if (pace === null && predictability === null) continue;
    rows.push({
      rigProfile: s.rigProfile,
      pace,
      paceN: s.paceN,
      predictability,
      predN: s.predN,
    });
  }
  return rows.sort(
    (a, b) =>
      Math.max(b.paceN, b.predN) - Math.max(a.paceN, a.predN) ||
      a.rigProfile.localeCompare(b.rigProfile)
  );
}
