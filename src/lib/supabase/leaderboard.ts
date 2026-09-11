import { unstable_cache } from "next/cache";

import { CACHE_TAG, SETUP_ROW_TAGS } from "@/lib/cache-tags";

import { normalizeHttpsUrl } from "@/lib/safe-url";
import { createPublicClient } from "@/lib/supabase/public";
import { unwrapList } from "@/lib/supabase/query-helpers";
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

    return unwrapList(result, "getCachedLeaderboardRows: failed to load leaderboard");
  },
  ["leaderboard"],
  { revalidate: 60, tags: [...SETUP_ROW_TAGS, CACHE_TAG.publicProfiles] }
);

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
