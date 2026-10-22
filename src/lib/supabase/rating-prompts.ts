import {
  pickPendingPrompts,
  PROMPT_LIMIT,
  type DownloadEvent,
  type RatingPrompt,
} from "@/lib/rating-prompts";
import { createClient } from "@/lib/supabase/server";

/**
 * Server reads for the 24h post-download rating prompt. Every function
 * fails soft (empty/null) -- the prompt is a courtesy, never a gate on
 * browsing, downloading, or rating. Download events are owner-only (0041),
 * so these can only ever see the caller's own history.
 */

async function loadPendingPromptPicks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  limit: number,
  setupId?: string
): Promise<{ setupId: string; downloadedAt: string }[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("setup_download_events")
    .select("setup_id, created_at, prompt_dismissed_at")
    .eq("user_id", userId)
    .lte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(100);
  if (setupId) query = query.eq("setup_id", setupId);

  const { data: rows, error } = await query;
  if (error || !rows) return [];

  const events: DownloadEvent[] = rows.map((row) => ({
    setupId: row.setup_id,
    createdAt: row.created_at,
    promptDismissedAt: row.prompt_dismissed_at,
  }));
  const candidateIds = Array.from(new Set(events.map((e) => e.setupId)));
  if (candidateIds.length === 0) return [];

  const [{ data: ratedRows }, { data: setupRows }] = await Promise.all([
    supabase.from("setup_ratings").select("setup_id").eq("user_id", userId).in("setup_id", candidateIds),
    supabase
      .from("setups")
      .select("id, game, car, track, user_id")
      .in("id", candidateIds),
  ]);

  const ratedSetupIds = new Set((ratedRows ?? []).map((row) => row.setup_id));
  const authorSetupIds = new Set(
    (setupRows ?? []).filter((row) => row.user_id === userId).map((row) => row.id)
  );

  return pickPendingPrompts(events, ratedSetupIds, authorSetupIds, limit);
}

/**
 * Up to `limit` setups the viewer downloaded 24h+ ago and hasn't rated or
 * dismissed. Never throws.
 */
export async function getPendingRatingPrompts(limit = PROMPT_LIMIT): Promise<RatingPrompt[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const picks = await loadPendingPromptPicks(supabase, user.id, limit);
    if (picks.length === 0) return [];

    const { data: setupRows, error } = await supabase
      .from("setups")
      .select("id, game, car, track")
      .in(
        "id",
        picks.map((p) => p.setupId)
      );
    if (error || !setupRows) return [];

    const byId = new Map(setupRows.map((row) => [row.id, row]));
    const prompts: RatingPrompt[] = [];
    for (const pick of picks) {
      const setup = byId.get(pick.setupId);
      if (!setup) continue;
      prompts.push({
        setupId: setup.id,
        game: setup.game,
        car: setup.car,
        track: setup.track,
        downloadedAt: pick.downloadedAt,
      });
    }
    return prompts;
  } catch {
    return [];
  }
}

/** Whether this specific setup is awaiting the viewer's take. Never throws. */
export async function hasPendingRatingPrompt(setupId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const picks = await loadPendingPromptPicks(supabase, user.id, 1, setupId);
    return picks.length > 0;
  } catch {
    return false;
  }
}
