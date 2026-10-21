import { unstable_cache } from "next/cache";

import { CACHE_TAG, SETUP_ROW_TAGS } from "@/lib/cache-tags";

import { normalizeHttpsUrl } from "@/lib/safe-url";
import { createPublicClient } from "@/lib/supabase/public";
import { unwrapCachedCount, unwrapCachedList } from "@/lib/supabase/query-helpers";
import { sanitizeDisplayName } from "@/lib/user-display";

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  setupCount: number;
  totalUpvotes: number;
  /** Laps other drivers logged in Garage sessions started from their setups (0041 count-only projection). */
  lapsDrivenByOthers: number;
  /** How many of their setups have at least one Garage-derived field-test report. */
  fieldTestedSetupCount: number;
}

const getCachedLeaderboardRows = unstable_cache(
  async (limit: number) => {
    const supabase = createPublicClient();
    // Impact-first ordering (0041): laps other drivers drove from your
    // setups, then field-tested setups; upvotes then setup count break
    // ties. When no impact exists yet this is exactly the old upvotes
    // order -- the page says so rather than pretending zeros are wins.
    const result = await supabase
      .from("leaderboard")
      .select(
        "user_id, username, avatar_url, setup_count, total_upvotes, laps_driven_by_others, field_tested_setup_count"
      )
      .order("laps_driven_by_others", { ascending: false })
      .order("field_tested_setup_count", { ascending: false })
      .order("total_upvotes", { ascending: false })
      .order("setup_count", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100));

    return unwrapCachedList(result, "getCachedLeaderboardRows: failed to load leaderboard");
  },
  ["leaderboard"],
  { revalidate: 60, tags: [...SETUP_ROW_TAGS, CACHE_TAG.publicProfiles] }
);

/**
 * Contributors with at least one published setup. Cached with the same policy
 * as the leaderboard rows; a failed count reads as 0 so the gated nav link
 * fails closed (hidden) rather than leaking an error state into the footer.
 */
const getCachedContributorCount = unstable_cache(
  async (): Promise<number> => {
    const supabase = createPublicClient();
    const result = await supabase
      .from("leaderboard")
      .select("user_id", { count: "exact", head: true })
      .gt("setup_count", 0);

    // Fail closed on error: the footer renders on every page and a missing
    // Leaderboard link (threshold treats 0 as "not ready") beats a 500.
    return unwrapCachedCount(result, "getCachedContributorCount: failed");
  },
  ["contributor-count"],
  { revalidate: 60, tags: [...SETUP_ROW_TAGS, CACHE_TAG.publicProfiles] }
);

/** Count of people who have shared at least one setup. Never throws. */
export async function getContributorCount(): Promise<number> {
  try {
    return await getCachedContributorCount();
  } catch {
    return 0;
  }
}

/**
 * The Leaderboard link stays out of the nav until this many contributors have
 * at least one setup each — a one-person leaderboard is worse than none (P1).
 * The route itself always stays reachable by URL.
 */
export const LEADERBOARD_MIN_CONTRIBUTORS = 10;

/**
 * Top contributors, impact-first: laps other drivers logged in Garage from
 * their setups, then field-tested setups (0041), upvotes last as tiebreak,
 * via the public.leaderboard view (0006 + 0023 + 0041). Public rows are
 * briefly cached across requests; content and counter mutations invalidate
 * this ranking.
 */
export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const rows = await getCachedLeaderboardRows(limit);

  return rows.map((row) => ({
    userId: row.user_id,
    username: sanitizeDisplayName(row.username),
    avatarUrl: normalizeHttpsUrl(row.avatar_url),
    setupCount: row.setup_count,
    totalUpvotes: row.total_upvotes,
    lapsDrivenByOthers: row.laps_driven_by_others ?? 0,
    fieldTestedSetupCount: row.field_tested_setup_count ?? 0,
  }));
}
