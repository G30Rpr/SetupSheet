"use server";

import { revalidatePath } from "next/cache";

import { getActionError } from "@/lib/actions/action-errors";
import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export interface AccountDeletionActionResult {
  request: {
    id: string;
    status: "pending";
    createdAt: string;
  } | null;
  error: string | null;
}

/** Creates one manual-review deletion request for the authenticated account. */
export async function requestAccountDeletion(): Promise<AccountDeletionActionResult> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return { request: null, error: "You need to be logged in to request account deletion." };
  }

  const { data, error } = await supabase
    .from("account_deletion_requests")
    .insert({ user_id: user.id })
    .select("id, status, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { request: null, error: "You already have an active deletion request." };
    }
    logger.error("requestAccountDeletion: insert failed", error);
    return { request: null, error: getActionError(error, "Couldn't submit the deletion request.") };
  }

  revalidatePath("/account/data-deletion");
  return {
    request: {
      id: data.id,
      status: "pending",
      createdAt: data.created_at,
    },
    error: null,
  };
}

/** Cancels a request only while it is still pending. */
export async function cancelAccountDeletionRequest(
  requestId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) return { error: "You need to be logged in." };
  if (!isUuid(requestId)) return { error: "That deletion request is invalid." };

  const { data, error } = await supabase
    .from("account_deletion_requests")
    .delete()
    .eq("id", requestId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    logger.error("cancelAccountDeletionRequest: delete failed", error);
    return { error: getActionError(error, "Couldn't cancel the deletion request.") };
  }
  if (!data) return { error: "Deletion request not found or no longer pending." };

  revalidatePath("/account/data-deletion");
  return { error: null };
}
