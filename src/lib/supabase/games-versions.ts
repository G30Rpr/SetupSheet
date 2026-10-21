import { logger } from "@/lib/logger";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * The operator-maintained current patch for one game (games_versions,
 * 0038). Null means "unknown" — the app makes no staleness claim without
 * it. Degrades to null on any read failure so a missing table or a flaky
 * read never breaks the detail page.
 */
export async function getGameCurrentVersion(game: string): Promise<string | null> {
  if (!game) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("games_versions")
    .select("current_version")
    .eq("game", game)
    .maybeSingle();

  if (error) {
    logger.warn("getGameCurrentVersion: unavailable", error);
    return null;
  }
  return data?.current_version ?? null;
}
