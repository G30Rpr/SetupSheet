import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export interface Profile {
  id: string;
  username: string;
  avatarUrl: string | null;
  memberSince: string;
  followerCount: number;
}

/** Fetches a profile row by user id, or null if it doesn't exist / the query fails. */
export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, created_at, follower_count")
    .eq("id", userId)
    .maybeSingle();

  if (error || !row) {
    if (error) logger.error("getProfile: failed to load profile", error);
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url,
    memberSince: row.created_at,
    followerCount: row.follower_count,
  };
}
