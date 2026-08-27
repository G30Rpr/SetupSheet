"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ALLOWED_SETUP_FILE_EXTENSIONS,
  ALLOWED_TELEMETRY_FILE_EXTENSIONS,
  getFileExtension,
  isOwnedStoragePath,
  MAX_SETUP_FILE_BYTES,
  MAX_STORED_FILE_NAME_LENGTH,
  MAX_TELEMETRY_FILE_BYTES,
  sanitizeFileName,
  SETUP_FILES_BUCKET,
} from "@/lib/storage";
import { normalizeSetupValues } from "@/lib/setup-values";
import type { SetupValues } from "@/lib/types";
import { validateSetupFields } from "@/lib/validate-setup-fields";
import { normalizeVideoUrl, validateVideoUrl } from "@/lib/video-url";
import { isUuid } from "@/lib/utils";

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
  setupValues?: SetupValues | null;
  filePath?: string | null;
  fileName?: string | null;
  videoUrl?: string | null;
  telemetryFilePath?: string | null;
  telemetryFileName?: string | null;
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
  setupValues?: SetupValues | null;
  filePath?: string | null;
  fileName?: string | null;
  videoUrl?: string | null;
  telemetryFilePath?: string | null;
  telemetryFileName?: string | null;
}

function validateAttachment(
  path: string | null | undefined,
  fileName: string | null | undefined,
  userId: string,
  allowedExtensions: readonly string[],
  label: string
): string | null {
  // Undefined for both fields means "leave the existing attachment alone"
  // in updateSetup. Null means explicitly clear it.
  if (path === undefined && fileName === undefined) return null;
  if (path === undefined || fileName === undefined) {
    return `${label} path and filename must be supplied together.`;
  }
  if (path === null) {
    return fileName === null ? null : `${label} filename must be cleared with its file.`;
  }
  if (!isOwnedStoragePath(path, userId)) {
    return `That ${label.toLowerCase()} file does not belong to your account.`;
  }
  if (typeof fileName !== "string" || !fileName || fileName.length > MAX_STORED_FILE_NAME_LENGTH) {
    return `${label} filename is invalid.`;
  }
  if (/[\u0000-\u001f\u007f]/.test(fileName)) {
    return `${label} filename contains invalid characters.`;
  }
  if (!allowedExtensions.includes(getFileExtension(fileName))) {
    return `Unsupported ${label.toLowerCase()} format.`;
  }
  return null;
}

function validateRating(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

/** Uploads a setup file to Storage under the current user's own folder. */
export async function uploadSetupFile(
  formData: FormData
): Promise<{ path: string | null; fileName: string | null; error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

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

  const safeFileName = sanitizeFileName(file.name);
  const path = `${user.id}/${randomUUID()}-${safeFileName}`;
  const { error } = await supabase.storage.from(SETUP_FILES_BUCKET).upload(path, file);

  if (error) {
    logger.error("uploadSetupFile: upload failed", error);
    return { path: null, fileName: null, error: error.message };
  }

  return { path, fileName: safeFileName, error: null };
}

/** Uploads a telemetry/data file (.ld, .ibt, .vbo, etc.) to Storage under user folder. */
export async function uploadTelemetryFile(
  formData: FormData
): Promise<{ path: string | null; fileName: string | null; error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return {
      path: null,
      fileName: null,
      error: "You need to be logged in with Discord to upload telemetry.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { path: null, fileName: null, error: "No telemetry file selected." };
  }

  if (file.size > MAX_TELEMETRY_FILE_BYTES) {
    return { path: null, fileName: null, error: "Telemetry file is too large — max 10 MB." };
  }

  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_TELEMETRY_FILE_EXTENSIONS.includes(extension)) {
    return {
      path: null,
      fileName: null,
      error: `Unsupported telemetry format. Allowed: ${ALLOWED_TELEMETRY_FILE_EXTENSIONS.join(", ")}`,
    };
  }

  const safeFileName = sanitizeFileName(file.name);
  const path = `${user.id}/telemetry-${randomUUID()}-${safeFileName}`;
  const { error } = await supabase.storage.from(SETUP_FILES_BUCKET).upload(path, file);

  if (error) {
    logger.error("uploadTelemetryFile: upload failed", error);
    return { path: null, fileName: null, error: error.message };
  }

  return { path, fileName: safeFileName, error: null };
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
  const user = await getCurrentUser(supabase);

  if (!user) {
    return { error: "You need to be logged in with Discord to upload a setup." };
  }

  const validationError = validateSetupFields(input);
  if (validationError) {
    return { error: validationError };
  }

  const videoError = validateVideoUrl(input.videoUrl);
  if (videoError) return { error: videoError };

  const fileError = validateAttachment(
    input.filePath,
    input.fileName,
    user.id,
    ALLOWED_SETUP_FILE_EXTENSIONS,
    "Setup"
  );
  if (fileError) return { error: fileError };

  const telemetryError = validateAttachment(
    input.telemetryFilePath,
    input.telemetryFileName,
    user.id,
    ALLOWED_TELEMETRY_FILE_EXTENSIONS,
    "Telemetry"
  );
  if (telemetryError) return { error: telemetryError };

  if (!validateRating(input.pace) || !validateRating(input.predictability)) {
    return { error: "Pace and Predictability must be whole numbers from 1 to 5." };
  }

  const normalizedSetupValues = normalizeSetupValues(input.setupValues);
  const normalizedVideoUrl = normalizeVideoUrl(input.videoUrl);
  const { data: setup, error } = await supabase
    .from("setups")
    .insert({
      user_id: user.id,
      game: input.game,
      car: input.car.trim(),
      track: input.track.trim(),
      condition: input.condition,
      lap_time: (typeof input.lapTime === "string" ? input.lapTime.trim() : "") || null,
      description: input.description,
      tags: input.tags,
      rig_profile: input.rigProfile,
      setup_values: normalizedSetupValues,
      file_path: input.filePath ?? null,
      file_name: input.fileName ?? null,
      video_url: normalizedVideoUrl,
      telemetry_file_path: input.telemetryFilePath ?? null,
      telemetry_file_name: input.telemetryFileName ?? null,
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
  const user = await getCurrentUser(supabase);

  if (!user) {
    return { error: "You need to be logged in with Discord to edit a setup." };
  }
  if (!isUuid(setupId)) {
    return { error: "That setup id is invalid." };
  }

  const validationError = validateSetupFields(input);
  if (validationError) {
    return { error: validationError };
  }

  if (input.videoUrl !== undefined) {
    const videoError = validateVideoUrl(input.videoUrl);
    if (videoError) return { error: videoError };
  }

  const fileError = validateAttachment(
    input.filePath,
    input.fileName,
    user.id,
    ALLOWED_SETUP_FILE_EXTENSIONS,
    "Setup"
  );
  if (fileError) return { error: fileError };

  const telemetryError = validateAttachment(
    input.telemetryFilePath,
    input.telemetryFileName,
    user.id,
    ALLOWED_TELEMETRY_FILE_EXTENSIONS,
    "Telemetry"
  );
  if (telemetryError) return { error: telemetryError };

  // Read the current row before touching Storage. The previous implementation
  // removed the old object first, so a failed database update left a setup
  // pointing at a deleted file. It also treated a zero-row update as success.
  const { data: existing, error: existingError } = await supabase
    .from("setups")
    .select("id, file_path, telemetry_file_path")
    .eq("id", setupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    logger.error("updateSetup: failed to load existing setup", existingError);
    return { error: "Couldn't load that setup." };
  }
  if (!existing) {
    return { error: "Setup not found or you don't own it." };
  }

  const updates: Record<string, unknown> = {
    game: input.game,
    car: input.car.trim(),
    track: input.track.trim(),
    condition: input.condition,
    lap_time: (typeof input.lapTime === "string" ? input.lapTime.trim() : "") || null,
    description: input.description,
    tags: input.tags,
    rig_profile: input.rigProfile,
  };

  if (input.setupValues !== undefined) {
    updates.setup_values = normalizeSetupValues(input.setupValues);
  }

  if (input.filePath !== undefined) {
    updates.file_path = input.filePath;
    updates.file_name = input.fileName ?? null;
  }

  if (input.videoUrl !== undefined) {
    updates.video_url = normalizeVideoUrl(input.videoUrl);
  }

  if (input.telemetryFilePath !== undefined) {
    updates.telemetry_file_path = input.telemetryFilePath;
    updates.telemetry_file_name = input.telemetryFileName ?? null;
  }

  const { data: updated, error } = await supabase
    .from("setups")
    .update(updates)
    .eq("id", setupId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    logger.error("updateSetup: update failed", error);
    return { error: error.message };
  }
  if (!updated) {
    return { error: "Setup no longer exists or you don't own it." };
  }

  // Database state is authoritative. Cleanup is deliberately after the
  // update: an object left orphaned is recoverable, while deleting it before
  // a failed update permanently breaks the still-published setup.
  if (
    input.filePath !== undefined &&
    existing.file_path &&
    existing.file_path !== input.filePath &&
    isOwnedStoragePath(existing.file_path, user.id)
  ) {
    const { error: removeError } = await supabase.storage
      .from(SETUP_FILES_BUCKET)
      .remove([existing.file_path]);
    if (removeError) logger.warn("updateSetup: failed to remove old setup file", removeError);
  }

  if (
    input.telemetryFilePath !== undefined &&
    existing.telemetry_file_path &&
    existing.telemetry_file_path !== input.telemetryFilePath &&
    isOwnedStoragePath(existing.telemetry_file_path, user.id)
  ) {
    const { error: removeError } = await supabase.storage
      .from(SETUP_FILES_BUCKET)
      .remove([existing.telemetry_file_path]);
    if (removeError) logger.warn("updateSetup: failed to remove old telemetry file", removeError);
  }

  revalidatePath("/setups");
  revalidatePath(`/setups/${setupId}`);
  revalidatePath("/");
  return { error: null };
}

export async function deleteSetup(setupId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return { error: "You need to be logged in with Discord to delete a setup." };
  }
  if (!isUuid(setupId)) {
    return { error: "That setup id is invalid." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("setups")
    .select("id, file_path, telemetry_file_path")
    .eq("id", setupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    logger.error("deleteSetup: failed to load setup", existingError);
    return { error: "Couldn't load that setup." };
  }
  if (!existing) {
    return { error: "Setup not found or you don't own it." };
  }

  // Delete the database row first. Storage cleanup is best-effort after the
  // row is gone; an orphaned object is recoverable, whereas deleting it first
  // would break the setup if the database operation failed.
  const { data: deleted, error } = await supabase
    .from("setups")
    .delete()
    .eq("id", setupId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    logger.error("deleteSetup: delete failed", error);
    return { error: error.message };
  }
  if (!deleted) {
    return { error: "Setup no longer exists or you don't own it." };
  }

  const paths = [existing.file_path, existing.telemetry_file_path].filter(
    (path): path is string => isOwnedStoragePath(path, user.id)
  );
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(SETUP_FILES_BUCKET)
      .remove(paths);
    if (removeError) logger.warn("deleteSetup: failed to remove attached files", removeError);
  }

  revalidatePath("/setups");
  revalidatePath(`/setups/${setupId}`);
  revalidatePath("/");
  revalidatePath("/profile");
  return { error: null };
}

export async function toggleUpvote(
  setupId: string,
  isCurrentlyUpvoted: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return { error: "You need to be logged in with Discord to upvote." };
  }
  if (!isUuid(setupId) || typeof isCurrentlyUpvoted !== "boolean") {
    return { error: "That upvote request is invalid." };
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
  const user = await getCurrentUser(supabase);

  if (!user) {
    return { error: "You need to be logged in with Discord to rate a setup." };
  }
  if (!isUuid(setupId)) {
    return { error: "That setup id is invalid." };
  }

  if (!validateRating(pace) || !validateRating(predictability)) {
    return { error: "Pace and Predictability must be whole numbers from 1 to 5." };
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

  if (!isUuid(setupId)) {
    return { url: null, fileName: null, error: "That setup id is invalid." };
  }

  const { data: setup, error } = await supabase
    .from("setups")
    .select("user_id, file_path, file_name")
    .eq("id", setupId)
    .maybeSingle();

  if (error || !setup?.file_path || !isOwnedStoragePath(setup.file_path, setup.user_id)) {
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

  // The caller updates its local download count optimistically. Avoid
  // invalidating whole browse/home pages for every anonymous click; download
  // counters are not cache-critical and the next normal render will refresh
  // them from Postgres.
  return { url: publicUrl, fileName: sanitizeFileName(setup.file_name ?? "setup-file"), error: null };
}

/**
 * Bumps the download counter for a setup exported client-side (manually
 * entered values with no uploaded file behind them). Same free-for-anyone
 * access as downloadSetup, just without a Storage object to look up.
 */
export async function recordSetupExport(setupId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  if (!isUuid(setupId)) {
    return { error: "That setup id is invalid." };
  }

  const { error } = await supabase.rpc("increment_downloads", { setup_id: setupId });

  if (error) {
    logger.error("recordSetupExport: increment_downloads failed", error);
    return { error: error.message };
  }

  // Download/export counts are updated optimistically in the card; avoid
  // invalidating high-traffic pages for every anonymous export.
  return { error: null };
}
