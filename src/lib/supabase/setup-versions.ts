import { unwrapList } from "@/lib/supabase/query-helpers";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { normalizeSetupValues } from "@/lib/setup-values";
import { sanitizeStoredFileName } from "@/lib/storage";
import { normalizeVideoUrl } from "@/lib/video-url";
import type { Condition, Game, RigProfile, SetupTag, SetupVersion } from "@/lib/types";

type SetupVersionRow = Tables<"setup_versions">;

// Keep the history projection explicit so a future private column cannot be
// pulled into a public Server Action response by accident.
const SETUP_VERSION_COLUMNS =
  "id, game, car, track, condition, lap_time, description, tags, rig_profile, setup_values, file_name, video_url, telemetry_file_name, created_at";

/**
 * Fetches a setup's edit history, newest first, capped at the most recent
 * 200 versions -- nothing stops an owner from editing their own setup
 * arbitrarily many times, and unlike every other list query in this data
 * layer this one had no bound at all. No author join needed -- the trigger
 * that writes these rows (0012_setup_versions.sql) only ever fires on the
 * owner's own edit, so `edited_by` is always the setup's current author,
 * already known to the caller from the parent Setup.
 */
export async function getSetupVersions(setupId: string): Promise<SetupVersion[]> {
  const supabase = await createClient();

  const result = await supabase
    .from("setup_versions")
    .select(SETUP_VERSION_COLUMNS)
    .eq("setup_id", setupId)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = unwrapList(result, "getSetupVersions: failed to load setup history");

  return (rows as unknown as SetupVersionRow[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    game: row.game as Game,
    car: row.car,
    track: row.track,
    condition: row.condition as Condition,
    lapTime: row.lap_time ?? "",
    description: row.description,
    tags: row.tags as SetupTag[],
    rigProfile: row.rig_profile as RigProfile,
    setupValues: normalizeSetupValues(row.setup_values),
    fileName: sanitizeStoredFileName(row.file_name),
    videoUrl: normalizeVideoUrl(row.video_url),
    telemetryFileName: sanitizeStoredFileName(row.telemetry_file_name),
  }));
}
