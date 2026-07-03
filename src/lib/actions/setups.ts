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

  const { error } = await supabase.from("setups").insert({
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
    pace: input.pace,
    predictability: input.predictability,
  });

  if (error) {
    console.error("createSetup: insert failed", error);
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
