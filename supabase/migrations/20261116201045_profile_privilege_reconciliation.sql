-- Forward repair for hosted privilege drift, including installations where
-- 0009/0044 are recorded but their intended grants are no longer present.
-- Keep the auth trigger and internal profile synchronization intact.
revoke execute on function public.sync_profile_from_auth(uuid, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

-- Table-level UPDATE overrides a narrower column grant. Clear both the
-- blanket grant and any explicit grants on server-maintained columns.
revoke update on public.profiles from public, anon, authenticated;
revoke update (id, created_at, follower_count) on public.profiles
  from public, anon, authenticated;
revoke update (username, avatar_url) on public.profiles from public, anon;
grant update (username, avatar_url) on public.profiles to authenticated;
