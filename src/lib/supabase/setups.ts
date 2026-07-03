import { createClient } from "@/lib/supabase/server";
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
  pace: number;
  predictability: number;
  upvotes: number;
  downloads: number;
  created_at: string;
}

function mapRow(
  row: SetupRow,
  upvotedSetupIds: Set<string>,
  usernames: Map<string, string>
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
    hasUpvoted: upvotedSetupIds.has(row.id),
    pace: row.pace,
    predictability: row.predictability,
    downloads: row.downloads,
    setupValues: row.setup_values ?? undefined,
  };
}

/**
 * Fetches every setup, newest first, with the current viewer's upvote state
 * attached. Returns an empty list (rather than throwing) if Supabase is
 * unreachable or the query fails, so a backend hiccup degrades to an empty
 * browse page instead of a 500.
 *
 * Deliberately avoids PostgREST's embedded-resource join syntax
 * (`.select("...,profiles(username)")`) — that requires the API's schema
 * cache to have picked up the setups→profiles foreign key, which doesn't
 * happen automatically for tables created via the SQL Editor rather than
 * Supabase's own migration tooling. Two flat queries side-steps that
 * failure mode entirely.
 */
export async function getSetups(): Promise<Setup[]> {
  const supabase = await createClient();

  const [{ data: rows, error }, { data: userData }] = await Promise.all([
    supabase
      .from("setups")
      .select(
        "id, user_id, game, car, track, condition, lap_time, description, tags, rig_profile, setup_values, pace, predictability, upvotes, downloads, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  if (error || !rows) {
    console.error("getSetups: failed to load setups", error);
    return [];
  }

  const usernames = new Map<string, string>();
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", userIds);
    if (profilesError) {
      console.error("getSetups: failed to load profiles", profilesError);
    } else {
      for (const profile of profiles ?? []) usernames.set(profile.id, profile.username);
    }
  }

  const upvotedSetupIds = new Set<string>();
  const user = userData?.user;
  if (user) {
    const { data: upvotes } = await supabase
      .from("setup_upvotes")
      .select("setup_id")
      .eq("user_id", user.id);
    for (const row of upvotes ?? []) upvotedSetupIds.add(row.setup_id);
  }

  return (rows as unknown as SetupRow[]).map((row) => mapRow(row, upvotedSetupIds, usernames));
}
