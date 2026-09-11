"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { tagsForProfileMutation } from "@/lib/cache-tags";
import { getActionError } from "@/lib/actions/action-errors";
import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

/** Follows or unfollows targetUserId as the current user. */
export async function toggleFollow(
  targetUserId: string,
  isCurrentlyFollowing: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return { error: "You need to be logged in with Discord to follow." };
  }
  if (!isUuid(targetUserId) || typeof isCurrentlyFollowing !== "boolean") {
    return { error: "That follow request is invalid." };
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
    return { error: getActionError(error, "Couldn't update your follow status.") };
  }

  for (const tag of tagsForProfileMutation()) revalidateTag(tag, "max");
  revalidatePath(`/profile/${targetUserId}`);
  return { error: null };
}
