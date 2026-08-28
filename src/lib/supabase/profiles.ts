import { unstable_cache } from "next/cache";
import { cache } from "react";

import { unwrapSingle } from "@/lib/supabase/query-helpers";
import { normalizeHttpsUrl } from "@/lib/safe-url";
import { createPublicClient } from "@/lib/supabase/public";
import { sanitizeDisplayName } from "@/lib/user-display";

export interface Profile {
  id: string;
  username: string;
  avatarUrl: string | null;
  memberSince: string;
  followerCount: number;
}

const getCachedProfileRow = unstable_cache(
  async (userId: string) => {
    const supabase = createPublicClient();
    const result = await supabase
      .from("profiles")
      .select("id, username, avatar_url, created_at, follower_count")
      .eq("id", userId)
      .maybeSingle();

    return unwrapSingle(result, "getCachedProfileRow: failed to load profile");
  },
  ["profile-by-id"],
  { revalidate: 60, tags: ["public-profiles"] }
);

/**
 * Fetches a public profile by user id, or null if it doesn't exist / the
 * query fails. The public row is cached briefly across requests; private
 * viewer/follow state remains outside this cache in the calling route.
 */
export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const row = await getCachedProfileRow(userId);
  if (!row) return null;

  return {
    id: row.id,
    username: sanitizeDisplayName(row.username),
    avatarUrl: normalizeHttpsUrl(row.avatar_url),
    memberSince: row.created_at,
    followerCount: row.follower_count,
  };
});
