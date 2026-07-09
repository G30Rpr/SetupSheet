import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export interface NotificationItem {
  id: string;
  actorId: string;
  actorUsername: string;
  actorAvatarUrl: string | null;
  setupId: string | null;
  car: string | null;
  track: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  actor_id: string;
  setup_id: string | null;
  read: boolean;
  created_at: string;
}

/**
 * Fetches a user's most recent notifications (newest first), with the
 * triggering actor's name/avatar and the setup's car/track attached.
 * Deliberately flat queries + in-memory joins, same reasoning as
 * getSetups in lib/supabase/setups.ts.
 */
export async function getNotifications(userId: string, limit = 20): Promise<NotificationItem[]> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("notifications")
    .select("id, actor_id, setup_id, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !rows) {
    logger.error("getNotifications: failed to load notifications", error);
    return [];
  }

  const typedRows = rows as NotificationRow[];
  const actorIds = Array.from(new Set(typedRows.map((r) => r.actor_id)));
  const setupIds = Array.from(new Set(typedRows.map((r) => r.setup_id).filter((id): id is string => Boolean(id))));

  const [{ data: actors }, { data: setups }] = await Promise.all([
    actorIds.length > 0
      ? supabase.from("profiles").select("id, username, avatar_url").in("id", actorIds)
      : Promise.resolve({ data: [] as { id: string; username: string; avatar_url: string | null }[] }),
    setupIds.length > 0
      ? supabase.from("setups").select("id, car, track").in("id", setupIds)
      : Promise.resolve({ data: [] as { id: string; car: string; track: string }[] }),
  ]);

  const actorById = new Map((actors ?? []).map((a) => [a.id, a]));
  const setupById = new Map((setups ?? []).map((s) => [s.id, s]));

  return typedRows.map((row) => {
    const actor = actorById.get(row.actor_id);
    const setup = row.setup_id ? setupById.get(row.setup_id) : undefined;
    return {
      id: row.id,
      actorId: row.actor_id,
      actorUsername: actor?.username ?? "Racer",
      actorAvatarUrl: actor?.avatar_url ?? null,
      setupId: row.setup_id,
      car: setup?.car ?? null,
      track: setup?.track ?? null,
      read: row.read,
      createdAt: row.created_at,
    };
  });
}

/** Count of unread notifications, for the bell badge. */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) {
    logger.error("getUnreadNotificationCount: failed to count notifications", error);
    return 0;
  }

  return count ?? 0;
}
