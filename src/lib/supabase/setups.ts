import { cache } from "react";

import { logger } from "@/lib/logger";
import { unwrapCount, unwrapList, unwrapSingle } from "@/lib/supabase/query-helpers";
import { createClient } from "@/lib/supabase/server";
import { SETUP_FILES_BUCKET } from "@/lib/storage";
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
  video_url?: string | null;
  telemetry_file_path?: string | null;
  telemetry_file_name?: string | null;
  pace: number;
  predictability: number;
  rating_count: number;
  upvotes: number;
  downloads: number;
  created_at: string;
}

const SETUP_COLUMNS =
  "id, user_id, game, car, track, condition, lap_time, description, tags, rig_profile, setup_values, file_path, file_name, video_url, telemetry_file_path, telemetry_file_name, pace, predictability, rating_count, upvotes, downloads, created_at";

/**
 * getSetups() feeds /setups' client-side fuzzy search and filtering, which
 * needs the full matching set in memory to work correctly -- unlike
 * getFeaturedSetups()/the sitemap queries, it can't just take a small
 * fixed-size slice. This caps the pathological case (an unbounded table
 * scan once the community grows into the thousands) while still being far
 * larger than any realistic filtered/browsed result set today.
 */
export const SETUPS_BROWSE_LIMIT = 500;

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || setupIds.length === 0) {
    return {
      userId: user?.id ?? null,
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
  const telemetryUrl = row.telemetry_file_path
    ? supabase.storage.from(SETUP_FILES_BUCKET).getPublicUrl(row.telemetry_file_path).data.publicUrl
    : null;
  const isVerified = Boolean(row.video_url || telemetryUrl);

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
    setupValues: row.setup_values ?? undefined,
    fileName: row.file_name,
    fileUrl: row.file_path
      ? supabase.storage.from(SETUP_FILES_BUCKET).getPublicUrl(row.file_path).data.publicUrl
      : null,
    videoUrl: row.video_url,
    telemetryFileName: row.telemetry_file_name,
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
    authors.set(profile.id, { username: profile.username, avatarUrl: profile.avatar_url });
  }
  return authors;
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

  const typedRows = rows as unknown as SetupRow[];
  const [viewer, authors] = await Promise.all([
    getViewer(
      supabase,
      typedRows.map((r) => r.id)
    ),
    getAuthors(
      supabase,
      typedRows.map((r) => r.user_id)
    ),
  ]);

  return typedRows.map((row) => mapRow(row, viewer, authors, supabase));
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

  const typedRows = rows as unknown as SetupRow[];
  const [viewer, authors] = await Promise.all([
    getViewer(
      supabase,
      typedRows.map((r) => r.id)
    ),
    getAuthors(
      supabase,
      typedRows.map((r) => r.user_id)
    ),
  ]);

  return typedRows.map((row) => mapRow(row, viewer, authors, supabase));
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
export async function getSetupSitemapEntries(): Promise<{ id: string; updatedAt: string }[]> {
  const supabase = await createClient();

  const result = await supabase
    .from("setups")
    .select("id, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  const rows = unwrapList(result, "getSetupSitemapEntries: failed to load setups");
  return rows.map((row) => ({ id: row.id as string, updatedAt: row.created_at as string }));
}

/**
 * Distinct contributor ids for the sitemap -- the leaderboard/badge system
 * exists specifically to drive traffic to these profile pages, so they
 * belong in the sitemap the same way individual setups do. No dedicated
 * view: dedupe client-side off the same bounded, newest-first setups
 * query, keeping each user's most recent upload as their "last modified".
 */
export async function getProfileSitemapEntries(): Promise<{ userId: string; updatedAt: string }[]> {
  const supabase = await createClient();

  const result = await supabase
    .from("setups")
    .select("user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  const rows = unwrapList(result, "getProfileSitemapEntries: failed to load setups");

  const seen = new Map<string, string>();
  for (const row of rows as { user_id: string; created_at: string }[]) {
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

  const typedRows = rows as unknown as SetupRow[];
  const [viewer, authors] = await Promise.all([
    getViewer(
      supabase,
      typedRows.map((r) => r.id)
    ),
    getAuthors(
      supabase,
      typedRows.map((r) => r.user_id)
    ),
  ]);

  return typedRows.map((row) => mapRow(row, viewer, authors, supabase));
}

/** Fetches every setup uploaded by a given user, newest first. */
export async function getSetupsByUser(userId: string): Promise<Setup[]> {
  const supabase = await createClient();

  const result = await supabase
    .from("setups")
    .select(SETUP_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const rows = unwrapList(result, "getSetupsByUser: failed to load setups");

  const typedRows = rows as unknown as SetupRow[];
  const [viewer, authors] = await Promise.all([
    getViewer(
      supabase,
      typedRows.map((r) => r.id)
    ),
    getAuthors(supabase, [userId]),
  ]);

  return typedRows.map((row) => mapRow(row, viewer, authors, supabase));
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

  const typedRow = row as unknown as SetupRow;
  const [viewer, authors] = await Promise.all([
    getViewer(supabase, [typedRow.id]),
    getAuthors(supabase, [typedRow.user_id]),
  ]);

  return mapRow(typedRow, viewer, authors, supabase);
});
