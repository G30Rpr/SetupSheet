import type { Setup } from "@/lib/types";

export type SortOption = "newest" | "trending" | "mostDownloaded" | "safest" | "fastest";

export const ALL = "all";

export interface SetupFilters {
  search: string;
  game: string;
  car: string;
  track: string;
  condition: string;
  rig: string;
}

/** Parses an "M:SS.mmm" lap time into total seconds; unparseable/blank times sort last. */
function lapTimeSeconds(lapTime: string): number {
  const match = lapTime.trim().match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (!match) return Infinity;
  const [, minutes, seconds] = match;
  return Number(minutes) * 60 + Number(seconds);
}

/** Iterative Levenshtein distance, capped early once it can no longer beat maxDistance. */
function withinEditDistance(a: string, b: string, maxDistance: number): boolean {
  if (Math.abs(a.length - b.length) > maxDistance) return false;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > maxDistance) return false;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length] <= maxDistance;
}

/**
 * Whether every whitespace-separated token of `query` matches somewhere in
 * `haystack` (AND semantics, order-independent) -- a token matches a
 * haystack word via exact substring first, falling back to a single-typo
 * (edit distance <=1) tolerance only when the substring check fails.
 */
function matchesQuery(haystack: string, query: string): boolean {
  const queryTokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0) return true;

  const haystackWords = haystack.toLowerCase().split(/\s+/).filter(Boolean);

  return queryTokens.every((token) =>
    haystackWords.some((word) => word.includes(token) || withinEditDistance(word, token, 1))
  );
}

export function filterAndSortSetups(
  setups: Setup[],
  filters: SetupFilters,
  sort: SortOption
): Setup[] {
  const query = filters.search.trim();
  const results = setups.filter((s) => {
    if (filters.game !== ALL && s.game !== filters.game) return false;
    if (filters.car !== ALL && s.car !== filters.car) return false;
    if (filters.track !== ALL && s.track !== filters.track) return false;
    if (filters.condition !== ALL && s.condition !== filters.condition) return false;
    if (filters.rig !== ALL && s.rigProfile !== filters.rig) return false;
    if (query) {
      const haystack = [s.game, s.car, s.track, s.author, s.description, ...s.tags].join(" ");
      if (!matchesQuery(haystack, query)) return false;
    }
    return true;
  });

  switch (sort) {
    case "trending":
      return [...results].sort((a, b) => b.upvotes - a.upvotes);
    case "mostDownloaded":
      return [...results].sort((a, b) => b.downloads - a.downloads);
    case "safest":
      return [...results].sort((a, b) => b.predictability - a.predictability);
    case "fastest":
      return [...results].sort((a, b) => lapTimeSeconds(a.lapTime) - lapTimeSeconds(b.lapTime));
    default:
      return results;
  }
}
