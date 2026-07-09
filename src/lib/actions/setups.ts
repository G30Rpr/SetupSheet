"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import {
  ALLOWED_SETUP_FILE_EXTENSIONS,
  MAX_SETUP_FILE_BYTES,
  SETUP_FILES_BUCKET,
} from "@/lib/storage";
import type { SetupValues } from "@/lib/types";
import { validateSetupFields } from "@/lib/validate-setup-fields";

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
  filePath?: string | null;
  fileName?: string | null;
}

export interface UpdateSetupInput {
  game: string;
  car: string;
  track: string;
  condition: string;
  lapTime: string;
  description: string;
  tags: string[];
  rigProfile: string;
  setupValues?: SetupValues;
  /**
   * Undefined = leave the attached file as-is. A string = replace it with
   * this newly-uploaded path. Null = remove the file entirely. Either of
   * the latter two triggers cleanup of the previous Storage object.
   */
  filePath?: string | null;
  fileName?: string | null;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Uploads a setup file to Storage under the current user's own folder. */
export async function uploadSetupFile(
  formData: FormData
): Promise<{ path: string | null; fileName: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      path: null,
      fileName: null,
      error: "You need to be logged in with Discord to upload a file.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { path: null, fileName: null, error: "No file selected." };
  }

  if (file.size > MAX_SETUP_FILE_BYTES) {
    return { path: null, fileName: null, error: "File is too large — max 5 MB." };
  }

  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_SETUP_FILE_EXTENSIONS.includes(extension)) {
    return {
      path: null,
      fileName: null,
      error: `Unsupported file type. Allowed: ${ALLOWED_SETUP_FILE_EXTENSIONS.join(", ")}`,
    };
  }

  const path = `${user.id}/${randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(SETUP_FILES_BUCKET).upload(path, file);

  if (error) {
    logger.error("uploadSetupFile: upload failed", error);
    return { path: null, fileName: null, error: error.message };
  }

  return { path, fileName: file.name, error: null };
}

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

  const validationError = validateSetupFields(input);
  if (validationError) {
    return { error: validationError };
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
      file_path: input.filePath ?? null,
      file_name: input.fileName ?? null,
    })
    .select("id")
    .single();

  if (error || !setup) {
    logger.error("createSetup: insert failed", error);
    return { error: error?.message ?? "Failed to create setup." };
  }

  const { error: ratingError } = await supabase.from("setup_ratings").insert({
    user_id: user.id,
    setup_id: setup.id,
    pace: input.pace,
    predictability: input.predictability,
  });

  if (ratingError) {
    logger.error("createSetup: initial rating insert failed", ratingError);
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

  const validationError = validateSetupFields(input);
  if (validationError) {
    return { error: validationError };
  }

  const updates: Record<string, unknown> = {
    game: input.game,
    car: input.car,
    track: input.track,
    condition: input.condition,
    lap_time: input.lapTime || null,
    description: input.description,
    tags: input.tags,
    rig_profile: input.rigProfile,
    setup_values: input.setupValues ?? null,
  };

  if (input.filePath !== undefined) {
    const { data: existing } = await supabase
      .from("setups")
      .select("file_path")
      .eq("id", setupId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.file_path && existing.file_path !== input.filePath) {
      await supabase.storage.from(SETUP_FILES_BUCKET).remove([existing.file_path]);
    }

    updates.file_path = input.filePath;
    updates.file_name = input.fileName ?? null;
  }

  const { error } = await supabase
    .from("setups")
    .update(updates)
    .eq("id", setupId)
    .eq("user_id", user.id);

  if (error) {
    logger.error("updateSetup: update failed", error);
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

  const { data: existing } = await supabase
    .from("setups")
    .select("file_path")
    .eq("id", setupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.file_path) {
    await supabase.storage.from(SETUP_FILES_BUCKET).remove([existing.file_path]);
  }

  const { error } = await supabase
    .from("setups")
    .delete()
    .eq("id", setupId)
    .eq("user_id", user.id);

  if (error) {
    logger.error("deleteSetup: delete failed", error);
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
    logger.error("toggleUpvote: mutation failed", error);
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
    logger.error("rateSetup: upsert failed", error);
    return { error: error.message };
  }

  revalidatePath("/setups");
  revalidatePath("/");
  return { error: null };
}

/**
 * Bumps the download counter and returns a public URL for the attached
 * file. Deliberately doesn't require login -- setups are free downloads for
 * anyone, the same as browsing itself.
 */
export async function downloadSetup(
  setupId: string
): Promise<{ url: string | null; fileName: string | null; error: string | null }> {
  const supabase = await createClient();

  const { data: setup, error } = await supabase
    .from("setups")
    .select("file_path, file_name")
    .eq("id", setupId)
    .maybeSingle();

  if (error || !setup?.file_path) {
    return { url: null, fileName: null, error: "No file attached to this setup." };
  }

  const { error: rpcError } = await supabase.rpc("increment_downloads", {
    setup_id: setupId,
  });

  if (rpcError) {
    logger.error("downloadSetup: increment_downloads failed", rpcError);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(SETUP_FILES_BUCKET).getPublicUrl(setup.file_path);

  revalidatePath("/setups");
  revalidatePath("/");
  return { url: publicUrl, fileName: setup.file_name, error: null };
}

/**
 * Bumps the download counter for a setup exported client-side (manually
 * entered values with no uploaded file behind them). Same free-for-anyone
 * access as downloadSetup, just without a Storage object to look up.
 */
export async function recordSetupExport(setupId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("increment_downloads", { setup_id: setupId });

  if (error) {
    logger.error("recordSetupExport: increment_downloads failed", error);
    return { error: error.message };
  }

  revalidatePath("/setups");
  revalidatePath("/");
  return { error: null };
}
