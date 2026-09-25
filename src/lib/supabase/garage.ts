import { logger } from "@/lib/logger";
import type {
  GarageLap,
  GarageRevision,
  GarageRunPlanItem,
  GarageSession,
  GarageSessionDetail,
} from "@/lib/garage";
import { normalizeSetupValues } from "@/lib/setup-values";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import type { Condition, RigProfile } from "@/lib/types";
import type { EngineerGame } from "@/lib/engineer-types";

const SESSION_COLUMNS =
  "id, user_id, source_setup_id, game, car, track, condition, rig, created_at, updated_at";
const REVISION_COLUMNS = "id, session_id, setup_values, note, created_at";
const RUN_PLAN_COLUMNS =
  "id, session_id, revision_id, parameter, direction, amount, verdict, note, created_at";
const LAP_COLUMNS = "id, session_id, revision_id, lap_time_ms, condition, note, created_at";
const GARAGE_SESSION_LIMIT = 50;
const GARAGE_CHILD_ROW_LIMIT = 200;

type GarageSessionRow = Tables<"garage_sessions">;
type GarageRevisionRow = Tables<"garage_revisions">;
type GarageRunPlanRow = Tables<"garage_run_plan_items">;
type GarageLapRow = Tables<"garage_laps">;

function mapSession(row: GarageSessionRow): GarageSession {
  return {
    id: row.id,
    game: row.game as EngineerGame,
    car: row.car,
    track: row.track,
    condition: row.condition as Condition,
    rig: row.rig as RigProfile | null,
    sourceSetupId: row.source_setup_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRevision(row: GarageRevisionRow): GarageRevision {
  const values = normalizeSetupValues(row.setup_values);
  return {
    id: row.id,
    sessionId: row.session_id,
    setupValues: values ? { ...values } : {},
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapRunPlanItem(row: GarageRunPlanRow): GarageRunPlanItem {
  return {
    id: row.id,
    sessionId: row.session_id,
    revisionId: row.revision_id,
    parameter: row.parameter,
    direction: row.direction as GarageRunPlanItem["direction"],
    amount: row.amount,
    verdict: row.verdict as GarageRunPlanItem["verdict"],
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapLap(row: GarageLapRow): GarageLap {
  return {
    id: row.id,
    sessionId: row.session_id,
    revisionId: row.revision_id,
    lapTimeMs: row.lap_time_ms,
    condition: row.condition as Condition,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function getGarageSessions(
  userId: string
): Promise<{ sessions: GarageSession[]; error: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("garage_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(GARAGE_SESSION_LIMIT);

  if (error || !data) {
    logger.error("getGarageSessions: failed to load private sessions", error);
    return { sessions: [], error: true };
  }

  return { sessions: (data as unknown as GarageSessionRow[]).map(mapSession), error: false };
}

export async function getGarageSessionDetail(
  userId: string,
  sessionId: string
): Promise<{ detail: GarageSessionDetail | null; error: boolean }> {
  const supabase = await createClient();
  const { data: sessionRow, error: sessionError } = await supabase
    .from("garage_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError) {
    logger.error("getGarageSessionDetail: failed to load session", sessionError);
    return { detail: null, error: true };
  }
  if (!sessionRow) return { detail: null, error: false };

  const [revisionsResult, runPlanResult, lapsResult] = await Promise.all([
    supabase
      .from("garage_revisions")
      .select(REVISION_COLUMNS)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(GARAGE_CHILD_ROW_LIMIT),
    supabase
      .from("garage_run_plan_items")
      .select(RUN_PLAN_COLUMNS)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(GARAGE_CHILD_ROW_LIMIT),
    supabase
      .from("garage_laps")
      .select(LAP_COLUMNS)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(GARAGE_CHILD_ROW_LIMIT),
  ]);

  if (revisionsResult.error || runPlanResult.error || lapsResult.error) {
    logger.error(
      "getGarageSessionDetail: failed to load session records",
      revisionsResult.error ?? runPlanResult.error ?? lapsResult.error
    );
    return { detail: null, error: true };
  }

  return {
    detail: {
      session: mapSession(sessionRow as unknown as GarageSessionRow),
      revisions: ((revisionsResult.data ?? []) as unknown as GarageRevisionRow[]).map(mapRevision),
      runPlanItems: ((runPlanResult.data ?? []) as unknown as GarageRunPlanRow[]).map(mapRunPlanItem),
      laps: ((lapsResult.data ?? []) as unknown as GarageLapRow[]).map(mapLap),
    },
    error: false,
  };
}
