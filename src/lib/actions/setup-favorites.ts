"use server";

import { revalidatePath } from "next/cache";

import { getActionError } from "@/lib/actions/action-errors";
import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

/** Favorites or unfavorites a setup as the current user, mirroring toggleUpvote/toggleFollow. */
export async function toggleFavorite(
  setupId: string,
  isCurrentlyFavorited: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return { error: "You need to be logged in with Discord to save a setup." };
  }
  if (!isUuid(setupId) || typeof isCurrentlyFavorited !== "boolean") {
    return { error: "That favorite request is invalid." };
  }

  const { error } = isCurrentlyFavorited
    ? await supabase
        .from("setup_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("setup_id", setupId)
    : await supabase.from("setup_favorites").insert({ user_id: user.id, setup_id: setupId });

  if (error) {
    logger.error("toggleFavorite: mutation failed", error);
    return { error: getActionError(error, "Couldn't update saved status.") };
  }

  revalidatePath("/profile");
  return { error: null };
}
