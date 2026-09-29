"use server";

import { revalidatePath } from "next/cache";

import {
  getGarageCompatibleSetupValues,
  parseCreateGarageLapInput,
  parseCreateGarageRevisionInput,
  parseCreateGarageRunPlanItemInput,
  parseCreateGarageSessionInput,
} from "@/lib/garage";
import { getActionError } from "@/lib/actions/action-errors";
import { logger } from "@/lib/logger";
import { ENGINEER_GAMES, type EngineerGame } from "@/lib/engineer-types";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getSetupById } from "@/lib/supabase/setups";
import { isUuid } from "@/lib/utils";

export async function createGarageSession(
  input: unknown
): Promise<{ sessionId: string | null; error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return { sessionId: null, error: "Log in to create a private Garage session." };

  const fields =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? input as Record<string, unknown>
      : null;
  const hasSourceSetup = Boolean(fields && Object.hasOwn(fields, "sourceSetupId"));
  let sourceSetupId: string | null = null;
  let parsed: ReturnType<typeof parseCreateGarageSessionInput>;

  if (hasSourceSetup) {
    if (!fields) return { sessionId: null, error: "Session details are invalid." };
    const requestedSetupId = fields.sourceSetupId;
    if (typeof requestedSetupId !== "string" || !isUuid(requestedSetupId)) {
      return { sessionId: null, error: "That source setup is invalid." };
    }
    if (typeof fields.copySourceSetupValues !== "boolean") {
      return { sessionId: null, error: "Choose whether to copy the source setup values." };
    }

    let sourceSetup;
    try {
      sourceSetup = await getSetupById(requestedSetupId);
    } catch (lookupError) {
      logger.error("createGarageSession: source setup lookup failed", lookupError);
      return { sessionId: null, error: "That public setup could not be loaded right now." };
    }
    if (!sourceSetup) return { sessionId: null, error: "That public setup could not be found." };
    if (!ENGINEER_GAMES.includes(sourceSetup.game as EngineerGame)) {
      return { sessionId: null, error: "Garage can start from ACC and Le Mans Ultimate setups only." };
    }

    const game = sourceSetup.game as EngineerGame;
    parsed = parseCreateGarageSessionInput({
      // Source identity is the only setup metadata accepted from the browser.
      // The actual session metadata always comes from the public setup reader.
      game,
      car: sourceSetup.car,
      track: sourceSetup.track,
      condition: sourceSetup.condition,
      rig: fields.rig,
      setupValues: fields.copySourceSetupValues
        ? getGarageCompatibleSetupValues(game, sourceSetup.setupValues)
        : fields.setupValues,
      baselineNote: fields.baselineNote,
    });
    sourceSetupId = sourceSetup.id;
  } else {
    parsed = parseCreateGarageSessionInput(input);
  }

  if (!parsed.value) return { sessionId: null, error: parsed.error ?? "Session details are invalid." };

  const { value } = parsed;
  const result = sourceSetupId
    ? await supabase.rpc("create_garage_session_from_setup_with_baseline", {
        p_source_setup_id: sourceSetupId,
        p_rig: value.rig,
        p_setup_values: value.setupValues,
        p_note: value.baselineNote || "Baseline",
      })
    : await supabase.rpc("create_garage_session_with_baseline", {
        p_game: value.game,
        p_car: value.car,
        p_track: value.track,
        p_condition: value.condition,
        p_rig: value.rig,
        p_setup_values: value.setupValues,
        p_note: value.baselineNote || "Baseline",
      });

  if (result.error || typeof result.data !== "string") {
    logger.error("createGarageSession: atomic create failed", result.error);
    return {
      sessionId: null,
      error: getActionError(result.error, "Couldn't create that Garage session right now."),
    };
  }

  revalidatePath("/garage");
  return { sessionId: result.data, error: null };
}

async function getOwnedSessionGame(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sessionId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("garage_sessions")
    .select("game")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logger.error("garage action: failed to verify session ownership", error);
    return null;
  }
  return data?.game ?? null;
}

async function ownsRevision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  revisionId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("garage_revisions")
    .select("id")
    .eq("id", revisionId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) logger.error("garage action: failed to verify revision ownership", error);
  return Boolean(data && !error);
}

export async function createGarageRevision(
  input: unknown
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return { error: "Log in to add a Garage revision." };
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { error: "Revision details are invalid." };
  }

  const fields = input as Record<string, unknown>;
  if (typeof fields.sessionId !== "string" || !isUuid(fields.sessionId)) {
    return { error: "That Garage session is invalid." };
  }
  const game = await getOwnedSessionGame(supabase, user.id, fields.sessionId);
  if (!game) return { error: "Garage session not found." };
  if (!ENGINEER_GAMES.includes(game as EngineerGame)) {
    return { error: "This session uses an unsupported game." };
  }

  const parsed = parseCreateGarageRevisionInput(input, game as EngineerGame);
  if (!parsed.value) return { error: parsed.error ?? "Revision details are invalid." };

  const { error } = await supabase.from("garage_revisions").insert({
    session_id: parsed.value.sessionId,
    setup_values: parsed.value.setupValues,
    note: parsed.value.note,
  });

  if (error) {
    logger.error("createGarageRevision: insert failed", error);
    return { error: getActionError(error, "Couldn't save that revision right now.") };
  }

  revalidatePath("/garage");
  return { error: null };
}

export async function createGarageRunPlanItem(
  input: unknown
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return { error: "Log in to add a Garage run-plan item." };

  const parsed = parseCreateGarageRunPlanItemInput(input);
  if (!parsed.value) return { error: parsed.error ?? "Run-plan details are invalid." };
  const ownedGame = await getOwnedSessionGame(supabase, user.id, parsed.value.sessionId);
  if (!ownedGame) return { error: "Garage session not found." };
  if (!(await ownsRevision(supabase, parsed.value.sessionId, parsed.value.revisionId))) {
    return { error: "That revision does not belong to this session." };
  }

  const { error } = await supabase.from("garage_run_plan_items").insert({
    session_id: parsed.value.sessionId,
    revision_id: parsed.value.revisionId,
    parameter: parsed.value.parameter,
    direction: parsed.value.direction,
    amount: parsed.value.amount,
    verdict: parsed.value.verdict,
    note: parsed.value.note,
  });

  if (error) {
    logger.error("createGarageRunPlanItem: insert failed", error);
    return { error: getActionError(error, "Couldn't save that run-plan result right now.") };
  }

  revalidatePath("/garage");
  return { error: null };
}

export async function createGarageLap(input: unknown): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return { error: "Log in to log a Garage lap." };

  const parsed = parseCreateGarageLapInput(input);
  if (!parsed.value) return { error: parsed.error };
  const ownedGame = await getOwnedSessionGame(supabase, user.id, parsed.value.sessionId);
  if (!ownedGame) return { error: "Garage session not found." };
  if (!(await ownsRevision(supabase, parsed.value.sessionId, parsed.value.revisionId))) {
    return { error: "That revision does not belong to this session." };
  }

  const { error } = await supabase.from("garage_laps").insert({
    session_id: parsed.value.sessionId,
    revision_id: parsed.value.revisionId,
    lap_time_ms: parsed.value.lapTimeMs,
    condition: parsed.value.condition,
    note: parsed.value.note,
  });

  if (error) {
    logger.error("createGarageLap: insert failed", error);
    return { error: getActionError(error, "Couldn't save that lap right now.") };
  }

  revalidatePath("/garage");
  return { error: null };
}

export async function deleteGarageSession(sessionId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return { error: "Log in to delete a Garage session." };
  if (!isUuid(sessionId)) return { error: "That Garage session is invalid." };

  const { data, error } = await supabase
    .from("garage_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    logger.error("deleteGarageSession: delete failed", error);
    return { error: getActionError(error, "Couldn't delete that Garage session right now.") };
  }
  if (!data) return { error: "Garage session not found." };

  revalidatePath("/garage");
  return { error: null };
}
