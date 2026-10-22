/**
 * Leaderboard display rules (Phase 3 contribution-flow rework). Pure and
 * unit-tested; the ranked query lives in src/lib/supabase/leaderboard.ts
 * and the rendering in src/app/leaderboard/page.tsx.
 *
 * The board ranks by impact: laps OTHER drivers logged in Garage from a
 * contributor's setups (0041's setup_impact_counts projection), then by
 * field-tested setups. Until impact exists anywhere, the page says so and
 * shows the same list ordered by upvotes (the SQL tiebreak already does
 * that ordering) instead of dressing zeros as achievements.
 */

export interface LeaderboardImpact {
  lapsDrivenByOthers: number;
  fieldTestedSetupCount: number;
}

/** Whether the board can honestly talk about impact yet. */
export function leaderboardMode(entries: readonly LeaderboardImpact[]): "impact" | "upvotes" {
  return entries.some((e) => e.lapsDrivenByOthers > 0 || e.fieldTestedSetupCount > 0)
    ? "impact"
    : "upvotes";
}

/**
 * A ranked list needs at least two people to be a ranking. A one-entry
 * "leaderboard" is a person card, not a board -- render the quiet state.
 */
export function isLeaderboardReady(entryCount: number): boolean {
  return entryCount >= 2;
}
