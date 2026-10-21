/**
 * The 24h post-download rating prompt (Phase 3 contribution flow).
 * Pure selection logic, unit-tested; the server reads live in
 * src/lib/supabase/rating-prompts.ts and the dismiss write in
 * src/lib/actions/rating-prompts.ts.
 *
 * Rules (all must hold for a prompt):
 *   - the download is at least PROMPT_MIN_AGE_MS old -- the prompt asks how
 *     the setup felt AFTER driving it, not in the download's afterglow;
 *   - the viewer has not rated the setup yet;
 *   - the viewer has not dismissed the prompt for that setup (any download
 *     row for the pair can carry the dismissal);
 *   - the viewer is not the setup's author (self-rating is DB-blocked).
 * One prompt per setup (the newest download's timestamp), newest first.
 */

export const PROMPT_MIN_AGE_MS = 24 * 60 * 60 * 1000;
export const PROMPT_LIMIT = 3;

export interface DownloadEvent {
  setupId: string;
  createdAt: string;
  promptDismissedAt: string | null;
}

export interface RatingPrompt {
  setupId: string;
  game: string;
  car: string;
  track: string;
  downloadedAt: string;
}

/**
 * Picks the setups worth prompting about from the viewer's download events.
 * `ratedSetupIds` and `authorSetupIds` are ordinary sets (the caller has
 * already scoped them to this viewer). `now` is injectable for tests.
 */
export function pickPendingPrompts(
  events: DownloadEvent[],
  ratedSetupIds: ReadonlySet<string>,
  authorSetupIds: ReadonlySet<string>,
  limit = PROMPT_LIMIT,
  now: number = Date.now()
): { setupId: string; downloadedAt: string }[] {
  const dismissed = new Set<string>();
  const latestBySetup = new Map<string, string>();

  // Events arrive newest-first from the query, but don't rely on that here.
  const sorted = [...events].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  );
  for (const event of sorted) {
    if (event.promptDismissedAt) dismissed.add(event.setupId);
    if (!latestBySetup.has(event.setupId)) {
      latestBySetup.set(event.setupId, event.createdAt);
    }
  }

  const picked: { setupId: string; downloadedAt: string }[] = [];
  for (const [setupId, downloadedAt] of latestBySetup) {
    if (picked.length >= limit) break;
    if (dismissed.has(setupId)) continue;
    if (ratedSetupIds.has(setupId)) continue;
    if (authorSetupIds.has(setupId)) continue;
    const downloadedMs = Date.parse(downloadedAt);
    if (!Number.isFinite(downloadedMs)) continue;
    if (now - downloadedMs < PROMPT_MIN_AGE_MS) continue;
    picked.push({ setupId, downloadedAt });
  }
  return picked;
}
