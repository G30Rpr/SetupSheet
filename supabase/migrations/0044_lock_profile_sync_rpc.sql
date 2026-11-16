-- 0044_lock_profile_sync_rpc.sql
-- SS-AUD-001 (P0): this legacy SECURITY DEFINER helper accepts an arbitrary
-- profile ID and metadata, and must never be callable via the public Data API.
--
-- Current handle_new_user() does its own profile upsert and does not invoke
-- sync_profile_from_auth; the historical helper is retained only to avoid
-- breaking an unknown internal caller while its deprecation is assessed.
-- Never grant this function back to PUBLIC, anon, or authenticated.

revoke execute on function public.sync_profile_from_auth(uuid, text, jsonb)
  from PUBLIC, anon, authenticated;

-- Also remove direct trigger helper execution from untrusted API roles.
-- Supabase Auth's internal DB trigger still fires as its owning DB role.
revoke execute on function public.handle_new_user()
  from PUBLIC, anon, authenticated;
