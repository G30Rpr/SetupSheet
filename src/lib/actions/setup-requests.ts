"use server";

import { revalidatePath } from "next/cache";

import { getActionError } from "@/lib/actions/action-errors";
import { MAX_CAR_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_TRACK_LENGTH, games } from "@/lib/data";
import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getSetupRequestsPage,
  type SetupRequestCursor,
  type SetupRequestsPage,
} from "@/lib/supabase/setup-requests";
import { isUuid } from "@/lib/utils";

const ISO_CURSOR_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

/** A client-supplied keyset cursor is a query string, so validate it first. */
function isValidRequestCursor(cursor: unknown): cursor is SetupRequestCursor {
  if (typeof cursor !== "object" || cursor === null || Array.isArray(cursor)) return false;
  const fields = cursor as Record<string, unknown>;

  return (
    typeof fields.createdAt === "string" &&
    fields.createdAt.length <= 64 &&
    ISO_CURSOR_PATTERN.test(fields.createdAt) &&
    !Number.isNaN(Date.parse(fields.createdAt)) &&
    isUuid(fields.id)
  );
}

/** Next page of open requests for the board's "load more" control. */
export async function loadMoreSetupRequests(
  cursor: SetupRequestCursor
): Promise<SetupRequestsPage> {
  if (!isValidRequestCursor(cursor)) {
    return {
      open: [],
      fulfilled: [],
      openTotal: 0,
      nextCursor: null,
      error: "That requests page request is invalid.",
    };
  }

  try {
    return await getSetupRequestsPage(cursor);
  } catch (error) {
    logger.error("loadMoreSetupRequests: unhandled failure", error);
    return {
      open: [],
      fulfilled: [],
      openTotal: 0,
      nextCursor: null,
      error: "Couldn't load more requests right now.",
    };
  }
}

export interface CreateSetupRequestInput {
  game: string;
  car: string;
  track: string;
  notes: string;
}

function validateRequestFields(input: unknown): string | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return "Invalid request fields.";
  }

  const fields = input as Record<string, unknown>;
  if (
    typeof fields.game !== "string" ||
    typeof fields.car !== "string" ||
    typeof fields.track !== "string" ||
    typeof fields.notes !== "string"
  ) {
    return "Invalid request fields.";
  }

  if (!games.includes(fields.game as (typeof games)[number])) {
    return "Unknown game.";
  }
  if (!fields.car.trim()) {
    return "Car is required.";
  }
  if (!fields.track.trim()) {
    return "Track is required.";
  }
  if (fields.car.length > MAX_CAR_LENGTH) {
    return `Car name is too long — max ${MAX_CAR_LENGTH} characters.`;
  }
  if (fields.track.length > MAX_TRACK_LENGTH) {
    return `Track name is too long — max ${MAX_TRACK_LENGTH} characters.`;
  }
  if (fields.notes.length > MAX_DESCRIPTION_LENGTH) {
    return `Notes are too long — max ${MAX_DESCRIPTION_LENGTH} characters.`;
  }
  return null;
}

export async function createSetupRequest(
  input: CreateSetupRequestInput
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return { error: "You need to be logged in with Discord to post a request." };
  }

  const validationError = validateRequestFields(input);
  if (validationError) {
    return { error: validationError };
  }

  const { error } = await supabase.from("setup_requests").insert({
    requester_id: user.id,
    game: input.game,
    car: input.car.trim(),
    track: input.track.trim(),
    notes: input.notes,
  });

  if (error) {
    logger.error("createSetupRequest: insert failed", error);
    return { error: getActionError(error, "Couldn't post the request right now.") };
  }

  revalidatePath("/requests");
  return { error: null };
}

/** Cancels one of the current user's own open requests. */
export async function deleteSetupRequest(requestId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return { error: "You need to be logged in." };
  }
  if (!isUuid(requestId)) {
    return { error: "That request id is invalid." };
  }

  const { data: deleted, error } = await supabase
    .from("setup_requests")
    .delete()
    .eq("id", requestId)
    .eq("requester_id", user.id)
    .is("fulfilled_setup_id", null)
    .select("id")
    .maybeSingle();

  if (error) {
    logger.error("deleteSetupRequest: delete failed", error);
    return { error: getActionError(error, "Couldn't cancel the request right now.") };
  }
  if (!deleted) {
    return { error: "Request not found or already fulfilled." };
  }

  revalidatePath("/requests");
  return { error: null };
}

/**
 * The current user's own setups matching a request's game/car/track, for
 * the "fulfill with one of your setups" picker -- lightweight (id/car/track
 * only) since it's just populating a dropdown, not a full Setup. Empty (not
 * an error) when logged out, so the picker just renders with nothing to
 * pick. Filtered to car/track here too (case/whitespace-insensitively), not
 * just game, so this only ever offers setups the fulfill_setup_request RPC
 * (0016_fulfill_request_hardening.sql) will actually accept -- otherwise a
 * user could pick a same-game-but-different-car candidate here and get a
 * confusing rejection from the RPC after confirming.
 */
export async function getMyMatchingSetupsAction(
  game: string,
  car: string,
  track: string
): Promise<{ id: string; car: string; track: string }[]> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user || typeof game !== "string" || typeof car !== "string" || typeof track !== "string") return [];

  const { data, error } = await supabase
    .from("setups")
    .select("id, car, track")
    .eq("user_id", user.id)
    .eq("game", game)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    logger.error("getMyMatchingSetupsAction: failed to load setups", error);
    return [];
  }

  const normalize = (s: string) => s.trim().toLowerCase();
  return data.filter(
    (setup) => normalize(setup.car) === normalize(car) && normalize(setup.track) === normalize(track)
  );
}

/**
 * Fulfills someone else's request with one of the current user's own
 * setups. Goes through the fulfill_setup_request() RPC (see
 * 0013_setup_requests.sql) rather than a plain update -- ownership of the
 * offered setup and "not already fulfilled" are both checked there, and
 * only that function is allowed to write fulfilled_setup_id/fulfilled_by.
 */
export async function fulfillSetupRequest(
  requestId: string,
  setupId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return { error: "You need to be logged in with Discord to fulfill a request." };
  }
  if (!isUuid(requestId) || !isUuid(setupId)) {
    return { error: "That fulfillment request is invalid." };
  }

  const { error } = await supabase.rpc("fulfill_setup_request", {
    request_id: requestId,
    setup_id: setupId,
  });

  if (error) {
    logger.error("fulfillSetupRequest: rpc failed", error);
    return {
      error: getActionError(error, "Couldn't fulfill the request right now.", [
        "Request not found",
        "This request has already been fulfilled",
        "You can only fulfill a request with a setup you own",
        "That setup does not match the request's game, car, and track",
      ]),
    };
  }

  revalidatePath("/requests");
  return { error: null };
}
