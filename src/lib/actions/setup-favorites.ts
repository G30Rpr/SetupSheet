"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

/** Favorites or unfavorites a setup as the current user, mirroring toggleUpvote/toggleFollow. */
export async function toggleFavorite(
  setupId: string,
  isCurrentlyFavorited: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in with Discord to save a setup." };
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
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { error: null };
}
