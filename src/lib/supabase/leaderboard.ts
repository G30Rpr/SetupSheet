import { normalizeHttpsUrl } from "@/lib/safe-url";
import { sanitizeDisplayName } from "@/lib/user-display";
import { unwrapList } from "@/lib/supabase/query-helpers";
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

  const result = await supabase
    .from("leaderboard")
    .select("user_id, username, avatar_url, setup_count, total_upvotes")
    .order("total_upvotes", { ascending: false })
    .limit(limit);

  const rows = unwrapList(result, "getLeaderboard: failed to load leaderboard");

  return rows.map((row) => ({
    userId: row.user_id,
    username: sanitizeDisplayName(row.username),
    avatarUrl: normalizeHttpsUrl(row.avatar_url),
    setupCount: row.setup_count,
    totalUpvotes: row.total_upvotes,
  }));
}
