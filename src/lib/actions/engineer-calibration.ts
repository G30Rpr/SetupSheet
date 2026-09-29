"use server";

import { getPublicEngineerCalibration } from "@/lib/supabase/engineer-calibration";

/** Anonymous, read-only lookup; callers always retain the static fallback. */
export async function loadEngineerCalibration(game: unknown, condition: unknown) {
  return getPublicEngineerCalibration(game, condition);
}
