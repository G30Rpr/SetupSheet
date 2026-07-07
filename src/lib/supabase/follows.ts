import { createClient } from "@/lib/supabase/server";

/** Whether viewerId currently follows targetUserId. False for a logged-out viewer. */
export async function isFollowing(viewerId: string | null, targetUserId: string): Promise<boolean> {
  if (!viewerId) return false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", viewerId)
    .eq("followed_id", targetUserId)
    .maybeSingle();

  return Boolean(data);
}
