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
}

const getCachedLeaderboardRows = unstable_cache(
  async (limit: number) => {
    const supabase = createPublicClient();
    const result = await supabase
      .from("leaderboard")
      .select("user_id, username, avatar_url, setup_count, total_upvotes")
      .order("total_upvotes", { ascending: false })
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
 * Top contributors ranked by total upvotes across all their setups, via the
 * public.leaderboard view (see migrations/0006_leaderboard_view.sql).
 * Public rows are briefly cached across requests; content and counter
 * mutations invalidate this ranking (upvotes decide its order).
 */
export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const rows = await getCachedLeaderboardRows(limit);

  return rows.map((row) => ({
    userId: row.user_id,
    username: sanitizeDisplayName(row.username),
    avatarUrl: normalizeHttpsUrl(row.avatar_url),
    setupCount: row.setup_count,
    totalUpvotes: row.total_upvotes,
  }));
}
