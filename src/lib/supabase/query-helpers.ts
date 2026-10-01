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

/** Unwraps a list-returning query, logging and defaulting to [] on failure. */
export function unwrapList<T>(result: ListResult<T>, message: string): T[] {
  if (result.error || !result.data) {
    logger.error(message, result.error);
    return [];
  }
  return result.data;
}

/** Unwraps a count-only query, logging and defaulting to 0 on failure. */
export function unwrapCount(result: CountResult, message: string): number {
  if (result.error) {
    logger.error(message, result.error);
    return 0;
  }
  return result.count ?? 0;
}

/** Unwraps a single-row query; a missing row is expected and remains null. */
export function unwrapSingle<T>(result: SingleResult<T>, message: string): T | null {
  if (result.error || !result.data) {
    if (result.error) logger.error(message, result.error);
    return null;
  }
  return result.data;
}

/**
 * Cached public reads must throw on database failures. Resolving with an empty
 * fallback would make Next's Data Cache retain the outage as good data for the
 * full revalidation window. These helpers deliberately use static thrown
 * messages so raw PostgREST details stay in server logs only.
 */
export function unwrapCachedList<T>(result: ListResult<T>, message: string): T[] {
  if (result.error || !result.data) {
    logger.error(message, result.error);
    throw new Error("Cached database read failed");
  }
  return result.data;
}

export function unwrapCachedCount(result: CountResult, message: string): number {
  if (result.error) {
    logger.error(message, result.error);
    throw new Error("Cached database read failed");
  }
  return result.count ?? 0;
}

export function unwrapCachedSingle<T>(result: SingleResult<T>, message: string): T | null {
  if (result.error) {
    logger.error(message, result.error);
    throw new Error("Cached database read failed");
  }
  return result.data;
}
