import { conditions, games, rigProfiles } from "@/lib/data";

export const ALL_BROWSE_FILTER = "all";
export const MAX_BROWSE_SEARCH_LENGTH = 80;

export interface BrowseFilters {
  search: string;
  game: string;
  car: string;
  track: string;
  condition: string;
  rig: string;
}

export const EMPTY_BROWSE_FILTERS: BrowseFilters = {
  search: "",
  game: ALL_BROWSE_FILTER,
  car: ALL_BROWSE_FILTER,
  track: ALL_BROWSE_FILTER,
  condition: ALL_BROWSE_FILTER,
  rig: ALL_BROWSE_FILTER,
};

function isAllowedOrAll(value: string, allowed: readonly string[]) {
  return value === ALL_BROWSE_FILTER || allowed.includes(value);
}

/** Validates untrusted URL/Server Action filter input before it reaches a query builder. */
export function normalizeBrowseFilters(input: unknown): BrowseFilters | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const fields = input as Record<string, unknown>;
  const values = [fields.search, fields.game, fields.car, fields.track, fields.condition, fields.rig];
  if (!values.every((value) => typeof value === "string")) return null;

  const search = (fields.search as string).trim();
  const game = fields.game as string;
  const car = fields.car as string;
  const track = fields.track as string;
  const condition = fields.condition as string;
  const rig = fields.rig as string;

  if (
    search.length > MAX_BROWSE_SEARCH_LENGTH ||
    car.length > 80 ||
    track.length > 80 ||
    !isAllowedOrAll(game, games) ||
    !isAllowedOrAll(condition, conditions) ||
    !isAllowedOrAll(rig, rigProfiles)
  ) {
    return null;
  }

  return { search, game, car, track, condition, rig };
}

/**
 * Converts the user search into a restricted PostgREST OR expression. Only
 * letters, numbers, spaces, underscores, and hyphens survive, so URL/action
 * input cannot inject commas, operators, parentheses, or wildcards. The
 * `author_username` field is supplied by the public `setup_search` view.
 */
export function buildBrowseSearchExpression(search: string): string | null {
  const terms = search
    .trim()
    .slice(0, MAX_BROWSE_SEARCH_LENGTH)
    .replace(/[^\p{L}\p{N}_-]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  if (terms.length === 0) return null;

  return terms
    .flatMap((term) => [
      `game.ilike.*${term}*`,
      `car.ilike.*${term}*`,
      `track.ilike.*${term}*`,
      `description.ilike.*${term}*`,
      `author_username.ilike.*${term}*`,
      `tags.cs.{${term}}`,
    ])
    .join(",");
}
