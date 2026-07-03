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
  pace: number;
  predictability: number;
  rating_count: number;
  upvotes: number;
  downloads: number;
  created_at: string;
}

const SETUP_COLUMNS =
  "id, user_id, game, car, track, condition, lap_time, description, tags, rig_profile, setup_values, file_path, file_name, pace, predictability, rating_count, upvotes, downloads, created_at";

interface Viewer {
  userId: string | null;
  upvotedSetupIds: Set<string>;
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
    return { userId: user?.id ?? null, upvotedSetupIds: new Set(), myRatings: new Map() };
  }

  const [{ data: upvotes }, { data: ratings }] = await Promise.all([
    supabase.from("setup_upvotes").select("setup_id").eq("user_id", user.id).in("setup_id", setupIds),
    supabase
      .from("setup_ratings")
      .select("setup_id, pace, predictability")
      .eq("user_id", user.id)
      .in("setup_id", setupIds),
  ]);

  const upvotedSetupIds = new Set((upvotes ?? []).map((row) => row.setup_id));
  const myRatings = new Map(
    (ratings ?? []).map((row) => [row.setup_id, { pace: row.pace, predictability: row.predictability }])
  );

  return { userId: user.id, upvotedSetupIds, myRatings };
}

function mapRow(
  row: SetupRow,
  viewer: Viewer,
  usernames: Map<string, string>,
  supabase: Awaited<ReturnType<typeof createClient>>
): Setup {
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
    author: usernames.get(row.user_id) ?? "Racer",
    uploadedAt: row.created_at,
    upvotes: row.upvotes,
    hasUpvoted: viewer.upvotedSetupIds.has(row.id),
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
  };
}

async function getUsernames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[]
): Promise<Map<string, string>> {
  const usernames = new Map<string, string>();
  if (userIds.length === 0) return usernames;

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", Array.from(new Set(userIds)));

  if (error) {
    console.error("getUsernames: failed to load profiles", error);
    return usernames;
  }
  for (const profile of profiles ?? []) usernames.set(profile.id, profile.username);
  return usernames;
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

  const { data: rows, error } = await supabase
    .from("setups")
    .select(SETUP_COLUMNS)
    .order("created_at", { ascending: false });

  if (error || !rows) {
    console.error("getSetups: failed to load setups", error);
    return [];
  }

  const typedRows = rows as unknown as SetupRow[];
  const [viewer, usernames] = await Promise.all([
    getViewer(
      supabase,
      typedRows.map((r) => r.id)
    ),
    getUsernames(
      supabase,
      typedRows.map((r) => r.user_id)
    ),
  ]);

  return typedRows.map((row) => mapRow(row, viewer, usernames, supabase));
}

/** Fetches every setup uploaded by a given user, newest first. */
export async function getSetupsByUser(userId: string): Promise<Setup[]> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("setups")
    .select(SETUP_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !rows) {
    console.error("getSetupsByUser: failed to load setups", error);
    return [];
  }

  const typedRows = rows as unknown as SetupRow[];
  const [viewer, usernames] = await Promise.all([
    getViewer(
      supabase,
      typedRows.map((r) => r.id)
    ),
    getUsernames(supabase, [userId]),
  ]);

  return typedRows.map((row) => mapRow(row, viewer, usernames, supabase));
}

/** Fetches a single setup by id, or null if it doesn't exist / the query fails. */
export async function getSetupById(id: string): Promise<Setup | null> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("setups")
    .select(SETUP_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    if (error) console.error("getSetupById: failed to load setup", error);
    return null;
  }

  const typedRow = row as unknown as SetupRow;
  const [viewer, usernames] = await Promise.all([
    getViewer(supabase, [typedRow.id]),
    getUsernames(supabase, [typedRow.user_id]),
  ]);

  return mapRow(typedRow, viewer, usernames, supabase);
}
