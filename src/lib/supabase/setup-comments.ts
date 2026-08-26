import { unwrapList } from "@/lib/supabase/query-helpers";
import { createClient } from "@/lib/supabase/server";
import type { SetupComment } from "@/lib/types";

interface SetupCommentRow {
  id: string;
  setup_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

/**
 * A setup's comment thread, oldest first (chronological, like a real
 * conversation) -- flat query + in-memory profile join, same reasoning as
 * getNotifications. Fetched newest-first with a cap (unlike every other
 * list query in this data layer, this had no bound at all -- a heavily
 * discussed setup would otherwise render every comment on every page view)
 * and then reversed, so a capped thread still shows its most recent
 * activity rather than silently truncating to the oldest 200 comments.
 */
export async function getSetupComments(setupId: string): Promise<SetupComment[]> {
  const supabase = await createClient();

  const [{ data: { user } }, result] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("setup_comments")
      .select("id, setup_id, user_id, body, created_at")
      .eq("setup_id", setupId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const rows = unwrapList(result, "getSetupComments: failed to load comments");
  const typedRows = (rows as unknown as SetupCommentRow[]).slice().reverse();

  const userIds = Array.from(new Set(typedRows.map((r) => r.user_id)));
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from("profiles").select("id, username, avatar_url").in("id", userIds)
      : { data: [] as { id: string; username: string; avatar_url: string | null }[] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return typedRows.map((row) => {
    const profile = profileById.get(row.user_id);
    return {
      id: row.id,
      setupId: row.setup_id,
      userId: row.user_id,
      username: profile?.username ?? "Racer",
      avatarUrl: profile?.avatar_url ?? null,
      body: row.body,
      createdAt: row.created_at,
      isOwner: user?.id === row.user_id,
    };
  });
}
