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
