import { unwrapList } from "@/lib/supabase/query-helpers";
import { createClient } from "@/lib/supabase/server";
import { getSetupsByIds } from "@/lib/supabase/setups";
import type { Setup } from "@/lib/types";

/**
 * A user's saved setups, most-recently-favorited first, for the "Saved"
 * section on their own profile -- favorites are private (see
 * 0014_setup_favorites.sql's RLS), so this only ever returns something
 * useful when userId is the current viewer.
 */
export async function getFavoritedSetups(userId: string): Promise<Setup[]> {
  const supabase = await createClient();

  const result = await supabase
    .from("setup_favorites")
    .select("setup_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const rows = unwrapList(result, "getFavoritedSetups: failed to load favorites");
  const setupIds = rows.map((row) => row.setup_id as string);
  if (setupIds.length === 0) return [];

  const setups = await getSetupsByIds(setupIds);

  // getSetupsByIds doesn't guarantee row order matches the ids passed in --
  // restore the most-recently-favorited-first order fetched above.
  const orderIndex = new Map(setupIds.map((id, i) => [id, i]));
  return setups.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));
}
