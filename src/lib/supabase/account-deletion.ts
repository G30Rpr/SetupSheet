import { createClient } from "@/lib/supabase/server";
import { unwrapList } from "@/lib/supabase/query-helpers";

export type AccountDeletionStatus = "pending" | "processing" | "completed" | "cancelled";

export interface AccountDeletionRequest {
  id: string;
  status: AccountDeletionStatus;
  createdAt: string;
  completedAt: string | null;
}

/** Returns the current user's most recent deletion request, if one exists. */
export async function getAccountDeletionRequest(
  userId: string
): Promise<AccountDeletionRequest | null> {
  const supabase = await createClient();
  const result = await supabase
    .from("account_deletion_requests")
    .select("id, status, created_at, completed_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  const rows = unwrapList(result, "getAccountDeletionRequest: failed to load request");
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    status: row.status as AccountDeletionStatus,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}
