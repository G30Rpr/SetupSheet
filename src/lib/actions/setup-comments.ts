"use server";

import { revalidatePath } from "next/cache";

import { MAX_COMMENT_LENGTH } from "@/lib/data";
import { logger } from "@/lib/logger";
import { getSetupComments } from "@/lib/supabase/setup-comments";
import { createClient } from "@/lib/supabase/server";
import type { SetupComment } from "@/lib/types";

/** A read, not a mutation -- lets the client-side comment panel fetch/refetch on demand. */
export async function getSetupCommentsAction(setupId: string): Promise<SetupComment[]> {
  return getSetupComments(setupId);
}

export async function createComment(
  setupId: string,
  body: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in with Discord to comment." };
  }

  const trimmed = body.trim();
  if (!trimmed) {
    return { error: "Comment can't be empty." };
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return { error: `Comment is too long — max ${MAX_COMMENT_LENGTH} characters.` };
  }

  const { error } = await supabase
    .from("setup_comments")
    .insert({ setup_id: setupId, user_id: user.id, body: trimmed });

  if (error) {
    logger.error("createComment: insert failed", error);
    return { error: error.message };
  }

  revalidatePath(`/setups/${setupId}`);
  return { error: null };
}

export async function deleteComment(
  commentId: string,
  setupId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in." };
  }

  const { error } = await supabase
    .from("setup_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) {
    logger.error("deleteComment: delete failed", error);
    return { error: error.message };
  }

  revalidatePath(`/setups/${setupId}`);
  return { error: null };
}
