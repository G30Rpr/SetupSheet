"use server";

import { revalidatePath } from "next/cache";

import { MAX_CAR_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_TRACK_LENGTH, games } from "@/lib/data";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export interface CreateSetupRequestInput {
  game: string;
  car: string;
  track: string;
  notes: string;
}

function validateRequestFields(input: CreateSetupRequestInput): string | null {
  if (!games.includes(input.game as (typeof games)[number])) {
    return "Unknown game.";
  }
  if (!input.car.trim()) {
    return "Car is required.";
  }
  if (!input.track.trim()) {
    return "Track is required.";
  }
  if (input.car.length > MAX_CAR_LENGTH) {
    return `Car name is too long — max ${MAX_CAR_LENGTH} characters.`;
  }
  if (input.track.length > MAX_TRACK_LENGTH) {
    return `Track name is too long — max ${MAX_TRACK_LENGTH} characters.`;
  }
  if (input.notes.length > MAX_DESCRIPTION_LENGTH) {
    return `Notes are too long — max ${MAX_DESCRIPTION_LENGTH} characters.`;
  }
  return null;
}

export async function createSetupRequest(
  input: CreateSetupRequestInput
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    car: input.car,
    track: input.track,
    notes: input.notes,
  });

  if (error) {
    logger.error("createSetupRequest: insert failed", error);
    return { error: error.message };
  }

  revalidatePath("/requests");
  return { error: null };
}

/** Cancels one of the current user's own open requests. */
export async function deleteSetupRequest(requestId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in." };
  }

  const { error } = await supabase
    .from("setup_requests")
    .delete()
    .eq("id", requestId)
    .eq("requester_id", user.id);

  if (error) {
    logger.error("deleteSetupRequest: delete failed", error);
    return { error: error.message };
  }

  revalidatePath("/requests");
  return { error: null };
}

/**
 * The current user's own setups for a given game, for the "fulfill with one
 * of your setups" picker -- lightweight (id/car/track only) since it's just
 * populating a dropdown, not a full Setup. Empty (not an error) when logged
 * out, so the picker just renders with nothing to pick.
 */
export async function getMyMatchingSetupsAction(
  game: string
): Promise<{ id: string; car: string; track: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("setups")
    .select("id, car, track")
    .eq("user_id", user.id)
    .eq("game", game)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("getMyMatchingSetupsAction: failed to load setups", error);
    return [];
  }

  return data;
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in with Discord to fulfill a request." };
  }

  const { error } = await supabase.rpc("fulfill_setup_request", {
    request_id: requestId,
    setup_id: setupId,
  });

  if (error) {
    logger.error("fulfillSetupRequest: rpc failed", error);
    return { error: error.message };
  }

  revalidatePath("/requests");
  return { error: null };
}
