"use server";

import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("markNotificationRead: mutation failed", error);
    return { error: error.message };
  }

  return { error: null };
}

export async function markAllNotificationsRead(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) {
    console.error("markAllNotificationsRead: mutation failed", error);
    return { error: error.message };
  }

  return { error: null };
}

/** Deletes the current user's already-read notifications, so the list doesn't grow forever with no way to prune it. */
export async function clearReadNotifications(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in." };
  }

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", user.id)
    .eq("read", true);

  if (error) {
    console.error("clearReadNotifications: delete failed", error);
    return { error: error.message };
  }

  return { error: null };
}
