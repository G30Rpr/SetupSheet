import { normalizeHttpsUrl } from "@/lib/safe-url";
import { sanitizeDisplayName } from "@/lib/user-display";
import { unwrapCount, unwrapList } from "@/lib/supabase/query-helpers";
import { createClient } from "@/lib/supabase/server";

export type NotificationType = "new_setup" | "request_fulfilled" | "new_comment" | "field_test";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actorId: string | null;
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
  type: string;
  actor_id: string;
  setup_id: string | null;
  field_test_report_id: string | null;
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

  const result = await supabase
    .from("notifications")
    .select("id, type, actor_id, setup_id, field_test_report_id, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = unwrapList(result, "getNotifications: failed to load notifications");

  const typedRows = rows as NotificationRow[];
  const actorIds = Array.from(new Set(
    typedRows.filter((row) => row.type !== "field_test").map((row) => row.actor_id)
  ));
  const setupIds = Array.from(new Set(typedRows.map((r) => r.setup_id).filter((id): id is string => Boolean(id))));
  const fieldTestReportIds = Array.from(new Set(
    typedRows
      .filter((row) => row.type === "field_test" && row.field_test_report_id)
      .map((row) => row.field_test_report_id as string)
  ));

  const [{ data: actors }, { data: setups }, { data: fieldTestReports }] = await Promise.all([
    actorIds.length > 0
      ? supabase.from("profiles").select("id, username, avatar_url").in("id", actorIds)
      : Promise.resolve({ data: [] as { id: string; username: string; avatar_url: string | null }[] }),
    setupIds.length > 0
      ? supabase.from("setups").select("id, car, track").in("id", setupIds)
      : Promise.resolve({ data: [] as { id: string; car: string; track: string }[] }),
    fieldTestReportIds.length > 0
      ? supabase
          .from("field_test_reports_public")
          .select("report_id, display_name")
          .in("report_id", fieldTestReportIds)
      : Promise.resolve({ data: [] as { report_id: string; display_name: string | null }[] }),
  ]);

  const actorById = new Map((actors ?? []).map((a) => [a.id, a]));
  const setupById = new Map((setups ?? []).map((s) => [s.id, s]));
  const fieldTestReportById = new Map((fieldTestReports ?? []).map((report) => [report.report_id, report]));

  return typedRows.map((row) => {
    const fieldTest = row.type === "field_test";
    const actor = fieldTest ? undefined : actorById.get(row.actor_id);
    const fieldTestReport = row.field_test_report_id
      ? fieldTestReportById.get(row.field_test_report_id)
      : undefined;
    const setup = row.setup_id ? setupById.get(row.setup_id) : undefined;
    return {
      id: row.id,
      type: row.type as NotificationType,
      actorId: fieldTest ? null : row.actor_id,
      actorUsername: fieldTest
        ? fieldTestReport?.display_name
          ? sanitizeDisplayName(fieldTestReport.display_name)
          : "Anonymous driver"
        : sanitizeDisplayName(actor?.username),
      actorAvatarUrl: fieldTest ? null : normalizeHttpsUrl(actor?.avatar_url),
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

  const result = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  return unwrapCount(result, "getUnreadNotificationCount: failed to count notifications");
}
