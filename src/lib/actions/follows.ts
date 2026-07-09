"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

/** Follows or unfollows targetUserId as the current user. */
export async function toggleFollow(
  targetUserId: string,
  isCurrentlyFollowing: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in with Discord to follow." };
  }

  if (user.id === targetUserId) {
    return { error: "You can't follow yourself." };
  }

  const { error } = isCurrentlyFollowing
    ? await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("followed_id", targetUserId)
    : await supabase.from("follows").insert({ follower_id: user.id, followed_id: targetUserId });

  if (error) {
    logger.error("toggleFollow: mutation failed", error);
    return { error: error.message };
  }

  revalidatePath(`/profile/${targetUserId}`);
  return { error: null };
}
