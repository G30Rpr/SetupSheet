"use server";

import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export async function markNotificationRead(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return { error: "You need to be logged in." };
  }
  if (!isUuid(id)) {
    return { error: "That notification id is invalid." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    logger.error("markNotificationRead: mutation failed", error);
    return { error: error.message };
  }

  return { error: null };
}

export async function markAllNotificationsRead(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return { error: "You need to be logged in." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) {
    logger.error("markAllNotificationsRead: mutation failed", error);
    return { error: error.message };
  }

  return { error: null };
}

/** Deletes the current user's already-read notifications, so the list doesn't grow forever with no way to prune it. */
export async function clearReadNotifications(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return { error: "You need to be logged in." };
  }

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", user.id)
    .eq("read", true);

  if (error) {
    logger.error("clearReadNotifications: delete failed", error);
    return { error: error.message };
  }

  return { error: null };
}
