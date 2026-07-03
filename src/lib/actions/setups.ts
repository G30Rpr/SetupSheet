"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { SetupValues } from "@/lib/types";

export interface CreateSetupInput {
  game: string;
  car: string;
  track: string;
  condition: string;
  lapTime: string;
  description: string;
  tags: string[];
  rigProfile: string;
  pace: number;
  predictability: number;
  setupValues?: SetupValues;
}

export type UpdateSetupInput = Omit<CreateSetupInput, "pace" | "predictability">;

/**
 * Inserts the setup row, then seeds the community rating with the
 * uploader's own pace/predictability pick — that's the same star-picker UX
 * as before, it just now becomes the first row in setup_ratings (and
 * therefore the starting average) rather than a fixed value nobody else
 * can ever change. If the rating insert fails after the setup succeeds,
 * the setup still exists with pace/predictability at their 0 default;
 * the uploader (or anyone) can rate it from the browse page afterward.
 */
export async function createSetup(
  input: CreateSetupInput
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in with Discord to upload a setup." };
  }

  const { data: setup, error } = await supabase
    .from("setups")
    .insert({
      user_id: user.id,
      game: input.game,
      car: input.car,
      track: input.track,
      condition: input.condition,
      lap_time: input.lapTime || null,
      description: input.description,
      tags: input.tags,
      rig_profile: input.rigProfile,
      setup_values: input.setupValues ?? null,
    })
    .select("id")
    .single();

  if (error || !setup) {
    console.error("createSetup: insert failed", error);
    return { error: error?.message ?? "Failed to create setup." };
  }

  const { error: ratingError } = await supabase.from("setup_ratings").insert({
    user_id: user.id,
    setup_id: setup.id,
    pace: input.pace,
    predictability: input.predictability,
  });

  if (ratingError) {
    console.error("createSetup: initial rating insert failed", ratingError);
  }

  revalidatePath("/setups");
  revalidatePath("/");
  return { error: null };
}

export async function updateSetup(
  setupId: string,
  input: UpdateSetupInput
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in with Discord to edit a setup." };
  }

  const { error } = await supabase
    .from("setups")
    .update({
      game: input.game,
      car: input.car,
      track: input.track,
      condition: input.condition,
      lap_time: input.lapTime || null,
      description: input.description,
      tags: input.tags,
      rig_profile: input.rigProfile,
      setup_values: input.setupValues ?? null,
    })
    .eq("id", setupId)
    .eq("user_id", user.id);

  if (error) {
    console.error("updateSetup: update failed", error);
    return { error: error.message };
  }

  revalidatePath("/setups");
  revalidatePath("/");
  return { error: null };
}

export async function deleteSetup(setupId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in with Discord to delete a setup." };
  }

  const { error } = await supabase
    .from("setups")
    .delete()
    .eq("id", setupId)
    .eq("user_id", user.id);

  if (error) {
    console.error("deleteSetup: delete failed", error);
    return { error: error.message };
  }

  revalidatePath("/setups");
  revalidatePath("/");
  return { error: null };
}

export async function toggleUpvote(
  setupId: string,
  isCurrentlyUpvoted: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in with Discord to upvote." };
  }

  const { error } = isCurrentlyUpvoted
    ? await supabase
        .from("setup_upvotes")
        .delete()
        .eq("user_id", user.id)
        .eq("setup_id", setupId)
    : await supabase.from("setup_upvotes").insert({ user_id: user.id, setup_id: setupId });

  if (error) {
    console.error("toggleUpvote: mutation failed", error);
    return { error: error.message };
  }

  revalidatePath("/setups");
  revalidatePath("/");
  return { error: null };
}

/** Rates (or re-rates) a setup as the current user. 1-5 stars each. */
export async function rateSetup(
  setupId: string,
  pace: number,
  predictability: number
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in with Discord to rate a setup." };
  }

  const { error } = await supabase
    .from("setup_ratings")
    .upsert(
      { user_id: user.id, setup_id: setupId, pace, predictability, updated_at: new Date().toISOString() },
      { onConflict: "user_id,setup_id" }
    );

  if (error) {
    console.error("rateSetup: upsert failed", error);
    return { error: error.message };
  }

  revalidatePath("/setups");
  revalidatePath("/");
  return { error: null };
}
