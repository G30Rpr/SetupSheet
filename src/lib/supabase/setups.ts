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
import { sanitizeDisplayName } from "@/lib/user-display";
import { normalizeVideoUrl } from "@/lib/video-url";
import type { Condition, Game, RigProfile, Setup, SetupTag, SetupValues } from "@/lib/types";

interface SetupRow {
  id: string;
  user_id: string;
  game: string;
  car: string;
  track: string;
  condition: string;
  lap_time: string | null;
  description: string;
  tags: string[];
  rig_profile: string;
  setup_values: SetupValues | null;
  file_path: string | null;
  file_name: string | null;
  video_url: string | null;
  telemetry_file_path: string | null;
  telemetry_file_name: string | null;
  pace: number;
  predictability: number;
  rating_count: number;
  upvotes: number;
  downloads: number;
  created_at: string;
}

// Keep the public projection explicit. Using `*` would silently expose a
// future private/admin column on every public setup response. Deploy the SQL
// migrations before the app when adding a new public field, then add it here
// and to SetupRow/mapRow in the same change.
const SETUP_COLUMNS = [
  "id",
  "user_id",
  "game",
  "car",
  "track",
  "condition",
  "lap_time",
  "description",
  "tags",
  "rig_profile",
  "setup_values",
  "file_path",
  "file_name",
  "video_url",
  "telemetry_file_path",
  "telemetry_file_name",
  "pace",
  "predictability",
  "rating_count",
  "upvotes",
  "downloads",
  "created_at",
].join(", ");

/**
 * getSetups() feeds /setups' client-side fuzzy search and filtering, which
 * needs the full matching set in memory to work correctly -- unlike
 * getFeaturedSetups()/the sitemap queries, it can't just take a small
 * fixed-size slice. This caps the pathological case (an unbounded table
 * scan once the community grows into the thousands) while still being far
 * larger than any realistic filtered/browsed result set today.
 */
export const SETUPS_BROWSE_LIMIT = 500;
/** Prevent a single profile page from turning into an unbounded public query. */
export const PROFILE_SETUPS_LIMIT = 500;

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
  rows: unknown[]
): Promise<Setup[]> {
  const typedRows = rows as SetupRow[];
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
 * rating state attached. Returns an empty list (rather than throwing) if
 * Supabase is unreachable or the query fails, so a backend hiccup degrades
 * to an empty browse page instead of a 500.
 *
 * Deliberately avoids PostgREST's embedded-resource join syntax
 * (`.select("...,profiles(username)")`) — that requires the API's schema
 * cache to have picked up the setups→profiles foreign key, which doesn't
 * happen automatically for tables created via the SQL Editor rather than
 * Supabase's own migration tooling. Flat queries + in-memory joins side-step
 * that failure mode entirely.
 */
export async function getSetups(): Promise<Setup[]> {
  const supabase = await createClient();

  const result = await supabase
    .from("setups")
    .select(SETUP_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(SETUPS_BROWSE_LIMIT);

  const rows = unwrapList(result, "getSetups: failed to load setups");
  return hydrateSetupRows(supabase, rows);
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

  const result = await supabase
    .from("setups")
    .select(SETUP_COLUMNS)
    .order("upvotes", { ascending: false })
    .limit(limit);

  const rows = unwrapList(result, "getFeaturedSetups: failed to load setups");
  return hydrateSetupRows(supabase, rows);
}

/** Total number of setups, for the landing page's stat tile -- a count-only query, no rows transferred. */
export async function getSetupCount(): Promise<number> {
  const supabase = await createClient();

  const result = await supabase
    .from("setups")
    .select("id", { count: "exact", head: true });

  return unwrapCount(result, "getSetupCount: failed to count setups");
}

/**
 * Id + timestamp only, for the sitemap -- no viewer/author joins, since
 * search engines don't need per-visitor upvote/rating state. Capped well
 * under the 50,000-URL sitemap limit as a defensive bound, same reasoning
 * as the landing page's featured-setups query.
 */
interface SitemapRow {
  id: string;
  user_id: string;
  created_at: string;
}

const getSitemapRows = cache(async (): Promise<SitemapRow[]> => {
  const supabase = await createClient();
  const result = await supabase
    .from("setups")
    .select("id, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  return unwrapList(result, "getSitemapRows: failed to load setups") as SitemapRow[];
});

export async function getSetupSitemapEntries(): Promise<{ id: string; updatedAt: string }[]> {
  const rows = await getSitemapRows();
  return rows.map((row) => ({ id: row.id, updatedAt: row.created_at }));
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
      seen.set(row.user_id, row.created_at);
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

/** Fetches every setup uploaded by a given user, newest first. */
export async function getSetupsByUser(userId: string): Promise<Setup[]> {
  const supabase = await createClient();

  const result = await supabase
    .from("setups")
    .select(SETUP_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(PROFILE_SETUPS_LIMIT);

  const rows = unwrapList(result, "getSetupsByUser: failed to load setups");
  return hydrateSetupRows(supabase, rows);
}

/**
 * Fetches a single setup by id, or null if it doesn't exist / the query
 * fails. Wrapped in React's cache() because the /setups/[id] route calls
 * this once from generateMetadata and again from the page component --
 * without it that'd be two round trips for the same row on every request.
 */
export const getSetupById = cache(async (id: string): Promise<Setup | null> => {
  const supabase = await createClient();

  const result = await supabase
    .from("setups")
    .select(SETUP_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  const row = unwrapSingle(result, "getSetupById: failed to load setup");
  if (!row) return null;

  const [setup] = await hydrateSetupRows(supabase, [row]);
  return setup ?? null;
});
