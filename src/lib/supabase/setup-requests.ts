import { logger } from "@/lib/logger";
import { unwrapCount, unwrapList } from "@/lib/supabase/query-helpers";
import { createClient } from "@/lib/supabase/server";
import { sanitizeDisplayName } from "@/lib/user-display";
import type { Game, MostWantedEntry, SetupRequest } from "@/lib/types";

interface SetupRequestRow {
  id: string;
  requester_id: string;
  game: string;
  car: string;
  track: string;
  notes: string;
  fulfilled_setup_id: string | null;
  fulfilled_by: string | null;
  fulfilled_at: string | null;
  created_at: string;
}

const SETUP_REQUEST_COLUMNS =
  "id, requester_id, game, car, track, notes, fulfilled_setup_id, fulfilled_by, fulfilled_at, created_at";

/** Open requests handed to the page at a time. */
export const REQUESTS_PAGE_SIZE = 25;
/** Fulfilled requests shown once, as a "recently answered" strip. */
export const FULFILLED_PREVIEW_SIZE = 10;

export interface SetupRequestCursor {
  createdAt: string;
  id: string;
}

export interface SetupRequestsPage {
  open: SetupRequest[];
  fulfilled: SetupRequest[];
  /** Exact number of open requests, so the board can say what it truncated. */
  openTotal: number;
  nextCursor: SetupRequestCursor | null;
  error: string | null;
}

/**
 * Resolves requester/fulfiller names and the fulfilling setup's car/track for a
 * mixed batch of request rows with two flat queries, same reasoning as
 * getNotifications in lib/supabase/notifications.ts (no PostgREST
 * embedded-resource joins, which depend on the API schema cache).
 */
async function hydrateSetupRequestRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: SetupRequestRow[]
): Promise<SetupRequest[]> {
  if (rows.length === 0) return [];

  const profileIds = Array.from(
    new Set(
      rows.flatMap((row) => [row.requester_id, row.fulfilled_by].filter((id): id is string => Boolean(id)))
    )
  );
  const fulfilledSetupIds = Array.from(
    new Set(rows.map((row) => row.fulfilled_setup_id).filter((id): id is string => Boolean(id)))
  );

  const [{ data: profiles }, { data: setups }] = await Promise.all([
    profileIds.length > 0
      ? supabase.from("profiles").select("id, username").in("id", profileIds)
      : Promise.resolve({ data: [] as { id: string; username: string }[] }),
    fulfilledSetupIds.length > 0
      ? supabase.from("setups").select("id, car, track").in("id", fulfilledSetupIds)
      : Promise.resolve({ data: [] as { id: string; car: string; track: string }[] }),
  ]);

  const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  const setupById = new Map((setups ?? []).map((s) => [s.id, s]));

  return rows.map((row) => {
    const fulfilledSetup = row.fulfilled_setup_id ? setupById.get(row.fulfilled_setup_id) : undefined;
    return {
      id: row.id,
      requesterId: row.requester_id,
      requesterUsername: sanitizeDisplayName(usernameById.get(row.requester_id)),
      game: row.game as Game,
      car: row.car,
      track: row.track,
      notes: row.notes,
      createdAt: row.created_at,
      fulfilledSetupId: row.fulfilled_setup_id,
      fulfilledCar: fulfilledSetup?.car ?? null,
      fulfilledTrack: fulfilledSetup?.track ?? null,
      fulfilledByUsername: row.fulfilled_by
        ? sanitizeDisplayName(usernameById.get(row.fulfilled_by))
        : null,
      fulfilledAt: row.fulfilled_at,
    };
  });
}

/** Keyset boundary for "older than this row", deterministic on equal timestamps. */
function buildRequestCursorFilter(cursor: SetupRequestCursor): string {
  return `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}

/**
 * One page of the requests board, ordered by real state rather than by which
 * rows happened to fall inside an arbitrary fetch window.
 *
 * The previous reader pulled the 100 newest rows of any status and then sorted
 * open ones to the front in JavaScript, so as soon as the newest 100 requests
 * were mostly answered, genuinely open requests silently disappeared from the
 * board with no pagination to reach them. Open requests are now their own
 * keyset-paginated query (backed by the partial index from 0013/0027) and
 * fulfilled ones become a short, explicitly labelled preview on the first page.
 */
export async function getSetupRequestsPage(
  cursor: SetupRequestCursor | null = null
): Promise<SetupRequestsPage> {
  const supabase = await createClient();

  let openQuery = supabase
    .from("setup_requests")
    .select(SETUP_REQUEST_COLUMNS)
    .is("fulfilled_setup_id", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(REQUESTS_PAGE_SIZE + 1);
  if (cursor) openQuery = openQuery.or(buildRequestCursorFilter(cursor));

  const [openResult, fulfilledResult, countResult] = await Promise.all([
    openQuery,
    cursor
      ? Promise.resolve(null)
      : supabase
          .from("setup_requests")
          .select(SETUP_REQUEST_COLUMNS)
          .not("fulfilled_setup_id", "is", null)
          .order("fulfilled_at", { ascending: false })
          .limit(FULFILLED_PREVIEW_SIZE),
    supabase
      .from("setup_requests")
      .select("id", { count: "exact", head: true })
      .is("fulfilled_setup_id", null),
  ]);

  if (openResult.error) {
    // Logged here rather than left to unwrapList: this branch has to fail the
    // whole page (a silently empty board would look like "no requests"), so the
    // underlying PostgREST error is the only thing that makes it debuggable.
    logger.error("getSetupRequestsPage: failed to load open requests", openResult.error);
    return {
      open: [],
      fulfilled: [],
      openTotal: 0,
      nextCursor: null,
      error: "Couldn't load the requests board right now.",
    };
  }

  const openFetched = unwrapList(
    openResult,
    "getSetupRequestsPage: failed to load open requests"
  ) as unknown as SetupRequestRow[];
  // One row past the page size is fetched purely as a "there is more" signal.
  const hasMoreOpen = openFetched.length > REQUESTS_PAGE_SIZE;
  const openRows = openFetched.slice(0, REQUESTS_PAGE_SIZE);
  const fulfilledRows = (fulfilledResult
    ? (unwrapList(fulfilledResult, "getSetupRequestsPage: failed to load fulfilled requests") as unknown as SetupRequestRow[])
    : []
  ).slice(0, FULFILLED_PREVIEW_SIZE);

  // Both lists share one hydration pass so the page costs two extra flat
  // queries total, not four.
  const hydrated = await hydrateSetupRequestRows(supabase, [...openRows, ...fulfilledRows]);
  const openIds = new Set(openRows.map((row) => row.id));
  const [open, fulfilled] = hydrated.reduce(
    (acc, request) => {
      acc[openIds.has(request.id) ? 0 : 1].push(request);
      return acc;
    },
    [[] as SetupRequest[], [] as SetupRequest[]]
  );

  const lastRow = openRows.at(-1);
  return {
    open,
    fulfilled,
    openTotal: unwrapCount(countResult, "getSetupRequestsPage: failed to count open requests"),
    nextCursor:
      hasMoreOpen && lastRow
        ? { createdAt: lastRow.created_at, id: lastRow.id }
        : null,
    error: null,
  };
}

/**
 * "Most wanted": open requests grouped by (game, car, track) inside the
 * board's rolling 90-day window, ranked by demand. The grouping, window, and
 * ordering all live in the `setup_requests_most_wanted` view
 * (0027_most_wanted_requests.sql), so this reads only the summary rows it
 * renders instead of pulling request bodies into React to count them -- and,
 * unlike the old client-side version, it never freezes when the board grows.
 */
export async function getMostWantedRequests(limit = 5): Promise<MostWantedEntry[]> {
  const supabase = await createClient();
  const capped = Math.min(Math.max(limit, 1), 25);

  const result = await supabase
    .from("setup_requests_most_wanted")
    .select("game, car, track, request_count, oldest_request_at")
    .order("request_count", { ascending: false })
    .order("oldest_request_at", { ascending: true })
    .limit(capped);

  const rows = unwrapList(
    result,
    "getMostWantedRequests: failed to load most-wanted aggregates"
  );

  return rows.map((row) => ({
    game: row.game as Game,
    car: row.car,
    track: row.track,
    requestCount: row.request_count,
    oldestRequestAt: row.oldest_request_at,
  }));
}
