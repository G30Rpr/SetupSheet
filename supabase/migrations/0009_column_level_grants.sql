-- RLS's `using`/`with check` scope WHICH ROWS a user can touch, but say
-- nothing about WHICH COLUMNS -- "own row" update policies on setups and
-- profiles have therefore always let a signed-in user directly overwrite
-- denormalized, trigger-owned fields on their own rows (upvotes, pace,
-- predictability, rating_count, downloads, follower_count), completely
-- bypassing the aggregation triggers those fields exist to protect. This
-- adds the missing column-level layer: revoke the blanket UPDATE grant
-- Supabase applies by default, then re-grant it only for the columns the
-- app itself ever writes to as a normal user action. The existing RLS
-- policies stay as-is and remain necessary -- row scoping and column
-- scoping are independent layers, both required.
--
-- The trigger functions that maintain the protected columns (e.g.
-- handle_upvote_insert, handle_follow_insert, recompute_setup_rating) are
-- unaffected: they run SECURITY DEFINER as the table owner, which isn't
-- subject to grants made to the authenticated role at all.

revoke update on public.setups from authenticated;
grant update (
  game, car, track, condition, lap_time, description,
  tags, rig_profile, setup_values, file_path, file_name
) on public.setups to authenticated;

revoke update on public.profiles from authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;
