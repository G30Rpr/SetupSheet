import { logger } from "@/lib/logger";

interface ListResult<T> {
  data: T[] | null;
  error: unknown;
}

interface CountResult {
  count: number | null;
  error: unknown;
}

interface SingleResult<T> {
  data: T | null;
  error: unknown;
}

/** Unwraps a list-returning Supabase query, logging `message` and defaulting to `[]` on failure. */
export function unwrapList<T>(result: ListResult<T>, message: string): T[] {
  if (result.error || !result.data) {
    logger.error(message, result.error);
    return [];
  }
  return result.data;
}

/** Unwraps a count-only Supabase query, logging `message` and defaulting to `0` on failure. A `0` count is a valid result, not a failure. */
export function unwrapCount(result: CountResult, message: string): number {
  if (result.error) {
    logger.error(message, result.error);
    return 0;
  }
  return result.count ?? 0;
}

/** Unwraps a single-row Supabase query (`.maybeSingle()`), defaulting to `null` on failure or not-found. Only logs `message` on a genuine error -- a merely-absent row is expected/silent. */
export function unwrapSingle<T>(result: SingleResult<T>, message: string): T | null {
  if (result.error || !result.data) {
    if (result.error) logger.error(message, result.error);
    return null;
  }
  return result.data;
}
