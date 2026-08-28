import { unstable_cache } from "next/cache";
import { cache } from "react";

import { logger } from "@/lib/logger";
import { unwrapCount, unwrapList, unwrapSingle } from "@/lib/supabase/query-helpers";
import { createClient } from "@/lib/supabase/server";
import {
  isOwnedStoragePath,
  sanitizeStoredFileName,
  SETUP_FILES_BUCKET,
} from "@/lib/storage";
import { normalizeSetupValues } from "@/lib/setup-values";
import { normalizeHttpsUrl } from "@/lib/safe-url";
import { getCurrentUser } from "@/lib/supabase/auth";
import {
  ALL_BROWSE_FILTER,
  buildBrowseSearchExpression,
  EMPTY_BROWSE_FILTERS,
  type BrowseFilters,
} from "@/lib/browse-filters";
import type { Tables } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";
import { sanitizeDisplayName } from "@/lib/user-display";
import { normalizeVideoUrl } from "@/lib/video-url";
import type { Condition, Game, RigProfile, Setup, SetupTag } from "@/lib/types";
import { SETUP_CARD_PAGE_SIZE } from "@/lib/ui-constants";
import { isUuid } from "@/lib/utils";

type SetupRow = Tables<"setups">;

// Keep the public projection explicit. Using `*` would silently expose a
// future private/admin column on every public setup response. Deploy the SQL
// migrations before the app when adding a new public field, then add it here
// and to SetupRow/mapRow in the same change.
const SETUP_COLUMNS =
  "id, user_id, game, car, track, condition, lap_time, description, tags, rig_profile, setup_values, file_path, file_name, video_url, telemetry_file_path, telemetry_file_name, pace, predictability, rating_count, upvotes, downloads, created_at, updated_at";

/**
 * getSetups() feeds /setups' client-side fuzzy search and filtering, which
 * needs the full matching set in memory to work correctly -- unlike
 * getFeaturedSetups()/the sitemap queries, it can't just take a small
 * fixed-size slice. This caps the pathological case (an unbounded table
 * scan once the community grows into the thousands) while still being far
 * larger than any realistic filtered/browsed result set today.
 */
export const SETUPS_BROWSE_LIMIT = 500;
export interface SetupCursor {
  createdAt: string;
  id: string;
}
/** Number of setup cards sent to a profile page at a time. */
export const PROFILE_SETUP_PAGE_SIZE = SETUP_CARD_PAGE_SIZE;

export interface ProfileSetupStats {
  setupCount: number;
  totalUpvotes: number;
  totalRatings: number;
}

export interface ProfileSetupPage {
  setups: Setup[];
  nextCursor: SetupCursor | null;
  error: string | null;
}

const PUBLIC_DATA_REVALIDATE_SECONDS = 60;
const PUBLIC_SETUP_CACHE_TAG = "public-setups";

const getCachedBrowseRows = unstable_cache(
  async (
    search: string,
    game: string,
    car: string,
    track: string,
    condition: string,
    rig: string
  ): Promise<SetupRow[]> => {
    const supabase = createPublicClient();
    const searchExpression = buildBrowseSearchExpression(search);
    let query = searchExpression
      ? supabase.from("setup_search").select(SETUP_COLUMNS)
      : supabase.from("setups").select(SETUP_COLUMNS);

    if (game !== ALL_BROWSE_FILTER) query = query.eq("game", game);
    if (car !== ALL_BROWSE_FILTER) query = query.eq("car", car);
    if (track !== ALL_BROWSE_FILTER) query = query.eq("track", track);
    if (condition !== ALL_BROWSE_FILTER) query = query.eq("condition", condition);
    if (rig !== ALL_BROWSE_FILTER) query = query.eq("rig_profile", rig);
    if (searchExpression) query = query.or(searchExpression);

    const result = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(SETUPS_BROWSE_LIMIT);

    return unwrapList(result, "getCachedBrowseRows: failed to load setups");
  },
  ["setups-browse"],
  { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS, tags: [PUBLIC_SETUP_CACHE_TAG] }
);

const getCachedFeaturedRows = unstable_cache(
  async (limit: number): Promise<SetupRow[]> => {
    const supabase = createPublicClient();
    const result = await supabase
      .from("setups")
      .select(SETUP_COLUMNS)
      .order("upvotes", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 24));

    return unwrapList(result, "getCachedFeaturedRows: failed to load setups");
  },
  ["setups-featured"],
  { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS, tags: [PUBLIC_SETUP_CACHE_TAG] }
);

const getCachedSetupCount = unstable_cache(
  async (): Promise<number> => {
    const supabase = createPublicClient();
    const result = await supabase.from("setups").select("id", { count: "exact", head: true });
    return unwrapCount(result, "getCachedSetupCount: failed to count setups");
  },
  ["setups-count"],
  { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS, tags: [PUBLIC_SETUP_CACHE_TAG] }
);

interface CachedProfileSetupPage {
  rows: SetupRow[];
  error: boolean;
}

const getCachedProfileSetupPage = unstable_cache(
  async (
    userId: string,
    cursorCreatedAt: string,
    cursorId: string
  ): Promise<CachedProfileSetupPage> => {
    const supabase = createPublicClient();
    let query = supabase
      .from("setups")
      .select(SETUP_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PROFILE_SETUP_PAGE_SIZE + 1);

    if (cursorCreatedAt && cursorId) {
      query = query.or(
        `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
      );
    }

    const result = await query;
    return {
      rows: unwrapList(result, "getCachedProfileSetupPage: failed to load setups"),
      error: Boolean(result.error),
    };
  },
  ["setups-profile-page"],
  { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS, tags: [PUBLIC_SETUP_CACHE_TAG] }
);

const getCachedProfileSetupStats = unstable_cache(
  async (userId: string): Promise<ProfileSetupStats | null> => {
    const supabase = createPublicClient();
    const result = await supabase
      .from("leaderboard")
      .select("setup_count, total_upvotes, total_ratings")
      .eq("user_id", userId)
      .maybeSingle();
    const row = unwrapSingle(result, "getCachedProfileSetupStats: failed to load profile totals");
    if (!row) return null;

    return {
      setupCount: row.setup_count,
      totalUpvotes: row.total_upvotes,
      totalRatings: row.total_ratings,
    };
  },
  ["profile-setup-stats"],
  { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS, tags: [PUBLIC_SETUP_CACHE_TAG, "public-profiles"] }
);

const getCachedSetupRowById = unstable_cache(
  async (id: string): Promise<SetupRow | null> => {
    const supabase = createPublicClient();
    const result = await supabase
      .from("setups")
      .select(SETUP_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    return unwrapSingle(result, "getCachedSetupRowById: failed to load setup");
  },
  ["setup-by-id"],
  { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS, tags: [PUBLIC_SETUP_CACHE_TAG] }
);

const getCachedAuthorName = unstable_cache(
  async (userId: string): Promise<string> => {
    const supabase = createPublicClient();
    const result = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
    const row = unwrapSingle(result, "getCachedAuthorName: failed to load profile");
    return sanitizeDisplayName(row?.username);
  },
  ["setup-author-name"],
  { revalidate: 60, tags: ["public-profiles"] }
);

type SetupSeoRow = Pick<
  SetupRow,
  "id" | "user_id" | "game" | "car" | "track" | "condition" | "lap_time" |
    "description" | "tags" | "created_at" | "updated_at"
>;

const getCachedSetupSeoRow = unstable_cache(
  async (id: string): Promise<SetupSeoRow | null> => {
    const supabase = createPublicClient();
    const result = await supabase
      .from("setups")
      .select("id, user_id, game, car, track, condition, lap_time, description, tags, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    return unwrapSingle(result, "getCachedSetupSeoRow: failed to load setup");
  },
  ["setup-seo-by-id"],
  { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS, tags: [PUBLIC_SETUP_CACHE_TAG] }
);

const SITEMAP_SETUP_LIMIT = 24_000;
const SITEMAP_PAGE_SIZE = 1_000;

const getCachedSitemapRows = unstable_cache(
  async (): Promise<SitemapRow[]> => {
    const supabase = createPublicClient();
    const rows: SitemapRow[] = [];
    let cursor: { createdAt: string; id: string } | null = null;

    // Supabase projects commonly cap one REST response at 1,000 rows. Walk
    // deterministic keyset pages instead of asking for one oversized range,
    // while keeping the whole sitemap read behind a one-hour Data Cache.
    while (rows.length < SITEMAP_SETUP_LIMIT) {
      let query = supabase
        .from("setups")
        .select("id, user_id, created_at, updated_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(Math.min(SITEMAP_PAGE_SIZE, SITEMAP_SETUP_LIMIT - rows.length));

      if (cursor) {
        query = query.or(
          `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
        );
      }

      const page = unwrapList(await query, "getCachedSitemapRows: failed to load setups") as SitemapRow[];
      if (page.length === 0) break;
      rows.push(...page);

      if (page.length < SITEMAP_PAGE_SIZE) break;
      const last = page[page.length - 1];
      const nextCursor = { createdAt: last.created_at, id: last.id };
      if (cursor && cursor.createdAt === nextCursor.createdAt && cursor.id === nextCursor.id) break;
      cursor = nextCursor;
    }

    return rows;
  },
  ["setups-sitemap"],
  { revalidate: 3600, tags: [PUBLIC_SETUP_CACHE_TAG] }
);

interface RelatedSetupRow {
  id: string;
  game: string;
  car: string;
  track: string;
  condition: string;
}

const getCachedRelatedRows = unstable_cache(
  async (setupId: string, game: string, limit: number): Promise<RelatedSetupRow[]> => {
    const supabase = createPublicClient();
    const result = await supabase
      .from("setups")
      .select("id, game, car, track, condition")
      .eq("game", game)
      .neq("id", setupId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 12));
    return unwrapList(result, "getCachedRelatedRows: failed to load setups");
  },
  ["setups-related"],
  { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS, tags: [PUBLIC_SETUP_CACHE_TAG] }
);

interface Viewer {
  userId: string | null;
  upvotedSetupIds: Set<string>;
  favoritedSetupIds: Set<string>;
  myRatings: Map<string, { pace: number; predictability: number }>;
}

async function getViewer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  setupIds: string[]
): Promise<Viewer> {
  if (setupIds.length === 0) {
    return {
      userId: null,
      upvotedSetupIds: new Set(),
      favoritedSetupIds: new Set(),
      myRatings: new Map(),
    };
  }

  const user = await getCurrentUser(supabase);
  if (!user) {
    return {
      userId: null,
      upvotedSetupIds: new Set(),
      favoritedSetupIds: new Set(),
      myRatings: new Map(),
    };
  }

  const [{ data: upvotes }, { data: favorites }, { data: ratings }] = await Promise.all([
    supabase.from("setup_upvotes").select("setup_id").eq("user_id", user.id).in("setup_id", setupIds),
    supabase.from("setup_favorites").select("setup_id").eq("user_id", user.id).in("setup_id", setupIds),
    supabase
      .from("setup_ratings")
      .select("setup_id, pace, predictability")
      .eq("user_id", user.id)
      .in("setup_id", setupIds),
  ]);

  const upvotedSetupIds = new Set((upvotes ?? []).map((row) => row.setup_id));
  const favoritedSetupIds = new Set((favorites ?? []).map((row) => row.setup_id));
  const myRatings = new Map(
    (ratings ?? []).map((row) => [row.setup_id, { pace: row.pace, predictability: row.predictability }])
  );

  return { userId: user.id, upvotedSetupIds, favoritedSetupIds, myRatings };
}

function mapRow(
  row: SetupRow,
  viewer: Viewer,
  authors: Map<string, { username: string; avatarUrl: string | null }>,
  supabase: Awaited<ReturnType<typeof createClient>>
): Setup {
  const author = authors.get(row.user_id);
  const safeVideoUrl = normalizeVideoUrl(row.video_url);
  const safeFilePath = isOwnedStoragePath(row.file_path, row.user_id) ? row.file_path : null;
  const safeTelemetryPath = isOwnedStoragePath(row.telemetry_file_path, row.user_id)
    ? row.telemetry_file_path
    : null;
  const telemetryUrl = safeTelemetryPath
    ? supabase.storage.from(SETUP_FILES_BUCKET).getPublicUrl(safeTelemetryPath).data.publicUrl
    : null;
  const isVerified = Boolean(safeVideoUrl || telemetryUrl);
  const setupValues = normalizeSetupValues(row.setup_values);

  return {
    id: row.id,
    game: row.game as Game,
    car: row.car,
    track: row.track,
    condition: row.condition as Condition,
    lapTime: row.lap_time ?? "",
    description: row.description,
    tags: row.tags as SetupTag[],
    rigProfile: row.rig_profile as RigProfile,
    author: author?.username ?? "Racer",
    authorId: row.user_id,
    authorAvatarUrl: author?.avatarUrl ?? null,
    uploadedAt: row.created_at,
    updatedAt: row.updated_at,
    upvotes: row.upvotes,
    hasUpvoted: viewer.upvotedSetupIds.has(row.id),
    hasFavorited: viewer.favoritedSetupIds.has(row.id),
    pace: row.pace,
    predictability: row.predictability,
    ratingCount: row.rating_count,
    myRating: viewer.myRatings.get(row.id) ?? null,
    isOwner: viewer.userId === row.user_id,
    downloads: row.downloads,
    setupValues: setupValues ?? undefined,
    fileName: sanitizeStoredFileName(row.file_name),
    fileUrl: safeFilePath
      ? supabase.storage.from(SETUP_FILES_BUCKET).getPublicUrl(safeFilePath).data.publicUrl
      : null,
    videoUrl: safeVideoUrl,
    telemetryFileName: sanitizeStoredFileName(row.telemetry_file_name),
    telemetryFileUrl: telemetryUrl,
    isVerifiedLap: isVerified,
  };
}

async function getAuthors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[]
): Promise<Map<string, { username: string; avatarUrl: string | null }>> {
  const authors = new Map<string, { username: string; avatarUrl: string | null }>();
  if (userIds.length === 0) return authors;

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", Array.from(new Set(userIds)));

  if (error) {
    logger.error("getAuthors: failed to load profiles", error);
    return authors;
  }
  for (const profile of profiles ?? []) {
    authors.set(profile.id, {
      username: sanitizeDisplayName(profile.username),
      avatarUrl: normalizeHttpsUrl(profile.avatar_url),
    });
  }
  return authors;
}

/** Hydrates a flat setup query with the viewer state and author metadata shared by every setup reader. */
async function hydrateSetupRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: SetupRow[]
): Promise<Setup[]> {
  const typedRows = rows;
  if (typedRows.length === 0) return [];

  const [viewer, authors] = await Promise.all([
    getViewer(
      supabase,
      typedRows.map((row) => row.id)
    ),
    getAuthors(
      supabase,
      typedRows.map((row) => row.user_id)
    ),
  ]);

  return typedRows.map((row) => mapRow(row, viewer, authors, supabase));
}

/**
 * Fetches every setup, newest first, with the current viewer's upvote and
 * rating state attached. Public rows are cached briefly; viewer state is
 * hydrated afterward with the request-bound SSR client. Returns an empty
 * list (rather than throwing) if Supabase is unreachable or the query fails,
 * so a backend hiccup degrades to an empty browse page instead of a 500.
 *
 * Deliberately avoids PostgREST's embedded-resource join syntax
 * (`.select("...,profiles(username)")`) — that requires the API's schema
 * cache to have picked up the setups→profiles foreign key, which doesn't
 * happen automatically for tables created via the SQL Editor rather than
 * Supabase's own migration tooling. Flat queries + in-memory joins side-step
 * that failure mode entirely.
 */
export async function getSetups(filters: BrowseFilters = EMPTY_BROWSE_FILTERS): Promise<Setup[]> {
  const supabase = await createClient();
  const rows = await getCachedBrowseRows(
    filters.search,
    filters.game,
    filters.car,
    filters.track,
    filters.condition,
    filters.rig
  );
  return hydrateSetupRows(supabase, rows);
}

/**
 * Keyset page for browse expansion. The `(created_at, id)` cursor makes
 * ordering deterministic even when multiple uploads share a timestamp.
 */
export async function getSetupsAfter(
  cursor: SetupCursor,
  filters: BrowseFilters = EMPTY_BROWSE_FILTERS
): Promise<{ setups: Setup[]; nextCursor: SetupCursor | null; error: string | null }> {
  const supabase = await createClient();
  const searchExpression = buildBrowseSearchExpression(filters.search);
  let query = searchExpression
    ? supabase.from("setup_search").select(SETUP_COLUMNS)
    : supabase.from("setups").select(SETUP_COLUMNS);

  // PostgREST exposes one `or` parameter. When searching, use the reliable
  // timestamp boundary and reserve that single OR expression for the search
  // fields; with no search, use the full composite cursor.
  if (searchExpression) {
    query = query.lt("created_at", cursor.createdAt);
  } else {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    );
  }

  if (filters.game !== ALL_BROWSE_FILTER) query = query.eq("game", filters.game);
  if (filters.car !== ALL_BROWSE_FILTER) query = query.eq("car", filters.car);
  if (filters.track !== ALL_BROWSE_FILTER) query = query.eq("track", filters.track);
  if (filters.condition !== ALL_BROWSE_FILTER) query = query.eq("condition", filters.condition);
  if (filters.rig !== ALL_BROWSE_FILTER) query = query.eq("rig_profile", filters.rig);
  if (searchExpression) query = query.or(searchExpression);

  const result = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(SETUPS_BROWSE_LIMIT);

  const rows = unwrapList(result, "getSetupsAfter: failed to load older setups");
  if (result.error) {
    return { setups: [], nextCursor: null, error: "Couldn't load older setups right now." };
  }

  const setups = await hydrateSetupRows(supabase, rows);
  const lastRow = rows.at(-1);
  return {
    setups,
    nextCursor:
      rows.length === SETUPS_BROWSE_LIMIT && lastRow
        ? { createdAt: lastRow.created_at, id: lastRow.id }
        : null,
    error: null,
  };
}

/**
 * Fetches the top `limit` setups by upvotes, for the landing page's
 * featured rail. Unlike getSetups(), this is bounded at the database --
 * the landing page gets the highest traffic of any route and needs no
 * more than a handful of cards, so it has no business pulling every row
 * in the table down to the client just to sort and slice in JS.
 */
export async function getFeaturedSetups(limit: number): Promise<Setup[]> {
  const supabase = await createClient();
  const rows = await getCachedFeaturedRows(limit);
  return hydrateSetupRows(supabase, rows);
}

/** Total number of setups, optionally scoped to the same server-side browse filters. */
export async function getSetupCount(filters: BrowseFilters = EMPTY_BROWSE_FILTERS): Promise<number> {
  // The landing-page stat and browse-page upper bound are intentionally
  // cached for a short window. Upload/update actions invalidate the tag, so
  // normal mutations remain fresh without making every anonymous page hit a
  // count query.
  if (
    filters.search === "" &&
    filters.game === ALL_BROWSE_FILTER &&
    filters.car === ALL_BROWSE_FILTER &&
    filters.track === ALL_BROWSE_FILTER &&
    filters.condition === ALL_BROWSE_FILTER &&
    filters.rig === ALL_BROWSE_FILTER
  ) {
    return getCachedSetupCount();
  }

  const supabase = await createClient();
  const searchExpression = buildBrowseSearchExpression(filters.search);
  let query = searchExpression
    ? supabase.from("setup_search").select("id", { count: "exact", head: true })
    : supabase.from("setups").select("id", { count: "exact", head: true });

  if (filters.game !== ALL_BROWSE_FILTER) query = query.eq("game", filters.game);
  if (filters.car !== ALL_BROWSE_FILTER) query = query.eq("car", filters.car);
  if (filters.track !== ALL_BROWSE_FILTER) query = query.eq("track", filters.track);
  if (filters.condition !== ALL_BROWSE_FILTER) query = query.eq("condition", filters.condition);
  if (filters.rig !== ALL_BROWSE_FILTER) query = query.eq("rig_profile", filters.rig);
  if (searchExpression) query = query.or(searchExpression);

  const result = await query;
  return unwrapCount(result, "getSetupCount: failed to count setups");
}

/**
 * Id + timestamp only, for the sitemap -- no viewer/author joins, since
 * search engines don't need per-visitor upvote/rating state. The source is
 * read in deterministic 1,000-row pages and capped at 24,000 setup URLs;
 * src/app/sitemap.ts budgets profile URLs so the final document remains
 * under the protocol's 50,000-URL limit.
 */
interface SitemapRow {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const getSitemapRows = cache(async (): Promise<SitemapRow[]> => getCachedSitemapRows());

export async function getSetupSitemapEntries(): Promise<{ id: string; updatedAt: string }[]> {
  const rows = await getSitemapRows();
  return rows.map((row) => ({ id: row.id, updatedAt: row.updated_at }));
}

/**
 * Distinct contributor ids for the sitemap -- the leaderboard/badge system
 * exists specifically to drive traffic to these profile pages, so they
 * belong in the sitemap the same way individual setups do. No dedicated
 * view: dedupe client-side off the same bounded, newest-first setups
 * query, keeping each user's most recent upload as their "last modified".
 */
export async function getProfileSitemapEntries(): Promise<{ userId: string; updatedAt: string }[]> {
  const rows = await getSitemapRows();

  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!seen.has(row.user_id)) {
      seen.set(row.user_id, row.updated_at);
    }
  }

  return Array.from(seen, ([userId, updatedAt]) => ({ userId, updatedAt }));
}

/**
 * Fetches a specific set of setups by id (order not guaranteed to match
 * `ids`), for the comparison tool -- picks up any of the requested ids that
 * exist rather than requiring all of them, so a stale/deleted id in the
 * URL just quietly drops out instead of failing the whole page.
 */
export async function getSetupsByIds(ids: string[]): Promise<Setup[]> {
  if (ids.length === 0) return [];

  const supabase = await createClient();

  const result = await supabase.from("setups").select(SETUP_COLUMNS).in("id", ids);

  const rows = unwrapList(result, "getSetupsByIds: failed to load setups");
  return hydrateSetupRows(supabase, rows);
}

/** Strict cursor contract used by profile pagination before building a PostgREST filter. */
const PROFILE_CURSOR_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function isValidProfileCursor(cursor: SetupCursor | null): boolean {
  return Boolean(
    cursor &&
      typeof cursor.createdAt === "string" &&
      cursor.createdAt.length <= 64 &&
      PROFILE_CURSOR_PATTERN.test(cursor.createdAt) &&
      !Number.isNaN(Date.parse(cursor.createdAt)) &&
      isUuid(cursor.id)
  );
}

/** Fetches one bounded page of a user's setups, newest first. */
export const getSetupsByUserPage = cache(
  async (userId: string, cursor: SetupCursor | null = null): Promise<ProfileSetupPage> => {
    if (!isUuid(userId) || (cursor !== null && !isValidProfileCursor(cursor))) {
      return { setups: [], nextCursor: null, error: "That profile page request is invalid." };
    }

    const supabase = await createClient();
    const cachedPage = await getCachedProfileSetupPage(
      userId,
      cursor?.createdAt ?? "",
      cursor?.id ?? ""
    );

    if (cachedPage.error) {
      return { setups: [], nextCursor: null, error: "Couldn't load profile setups right now." };
    }

    const pageRows = cachedPage.rows.slice(0, PROFILE_SETUP_PAGE_SIZE);
    const setups = await hydrateSetupRows(supabase, pageRows);
    const lastRow = pageRows.at(-1);

    return {
      setups,
      nextCursor:
        cachedPage.rows.length > PROFILE_SETUP_PAGE_SIZE && lastRow
          ? { createdAt: lastRow.created_at, id: lastRow.id }
          : null,
      error: null,
    };
  }
);

/** Cached aggregate totals keep the profile header accurate without loading every setup card. */
export async function getProfileSetupStats(userId: string): Promise<ProfileSetupStats | null> {
  return getCachedProfileSetupStats(userId);
}

export interface SetupSeoData {
  id: string;
  userId: string;
  game: Game;
  car: string;
  track: string;
  condition: Condition;
  lapTime: string;
  description: string;
  tags: SetupTag[];
  author: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * The metadata/OG routes only need public fields and never need viewer
 * state. Keeping this reader separate from getSetupById avoids the upvote,
 * favorite, rating, and ownership joins during metadata generation, while
 * reusing the shared public detail row cache.
 */
export const getSetupSeoData = cache(async (id: string): Promise<SetupSeoData | null> => {
  const row = await getCachedSetupSeoRow(id);
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    game: row.game as Game,
    car: row.car,
    track: row.track,
    condition: row.condition as Condition,
    lapTime: row.lap_time ?? "",
    description: row.description,
    tags: row.tags as SetupTag[],
    author: await getCachedAuthorName(row.user_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
});

export interface RelatedSetup {
  id: string;
  game: Game;
  car: string;
  track: string;
  condition: Condition;
}

/** Small, public-only related-links query used to strengthen setup discovery without mounting more SetupCards. */
export const getRelatedSetups = cache(async (setupId: string, game: Game, limit = 6): Promise<RelatedSetup[]> => {
  const rows = await getCachedRelatedRows(setupId, game, limit);
  return rows.map((row) => ({
    id: row.id,
    game: row.game as Game,
    car: row.car,
    track: row.track,
    condition: row.condition as Condition,
  }));
});

/**
 * Fetches a single setup by id, or null if it doesn't exist / the query
 * fails. Wrapped in React's cache() because the /setups/[id] route calls
 * this once from generateMetadata and again from the page component --
 * without it that'd be two round trips for the same row on every request.
 */
export const getSetupById = cache(async (id: string): Promise<Setup | null> => {
  const supabase = await createClient();
  const row = await getCachedSetupRowById(id);
  if (!row) return null;

  const [setup] = await hydrateSetupRows(supabase, [row]);
  return setup ?? null;
});
