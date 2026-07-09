import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  setupCount: number;
  totalUpvotes: number;
}

/**
 * Top contributors ranked by total upvotes across all their setups, via the
 * public.leaderboard view (see migrations/0006_leaderboard_view.sql).
 * Contributors with zero setups still appear (their rank just won't move),
 * so this is really "everyone with a profile, ranked" rather than a
 * setups-only view.
 */
export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("leaderboard")
    .select("user_id, username, avatar_url, setup_count, total_upvotes")
    .order("total_upvotes", { ascending: false })
    .limit(limit);

  if (error || !rows) {
    logger.error("getLeaderboard: failed to load leaderboard", error);
    return [];
  }

  return rows.map((row) => ({
    userId: row.user_id,
    username: row.username,
    avatarUrl: row.avatar_url,
    setupCount: row.setup_count,
    totalUpvotes: row.total_upvotes,
  }));
}
