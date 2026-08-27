import { unwrapSingle } from "@/lib/supabase/query-helpers";
import { createClient } from "@/lib/supabase/server";
import { normalizeHttpsUrl } from "@/lib/safe-url";
import { sanitizeDisplayName } from "@/lib/user-display";

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

  const result = await supabase
    .from("profiles")
    .select("id, username, avatar_url, created_at, follower_count")
    .eq("id", userId)
    .maybeSingle();

  const row = unwrapSingle(result, "getProfile: failed to load profile");
  if (!row) return null;

  return {
    id: row.id,
    username: sanitizeDisplayName(row.username),
    avatarUrl: normalizeHttpsUrl(row.avatar_url),
    memberSince: row.created_at,
    followerCount: row.follower_count,
  };
}
