-- Retention helpers for the public `setup-files` bucket.
--
-- Two gaps motivated this:
--
-- 1. Objects are uploaded *before* the setup row exists (the Server Action
--    needs the path to store), so any submit that then fails validation, hits
--    the upload rate limit, or dies mid-request leaves a public object with no
--    row pointing at it. Nothing in the application ever removes those.
-- 2. Deleting an account cascades profiles -> setups -> ratings/comments, but
--    `storage.objects` is not in that cascade: a completed deletion request
--    left the ex-user's files publicly downloadable forever, which is a
--    retention problem, not just a leak.
--
-- These functions only *enumerate*. Deleting a Storage object has to go through
-- the Storage API (or the dashboard) so the backing blob and its CDN entries
-- are removed too; deleting a `storage.objects` row by hand would orphan the
-- bytes instead of the row. They are therefore SECURITY DEFINER and executable
-- by the service role only -- `anon`/`authenticated` must not be able to
-- enumerate other users' object names.

create or replace function public.orphaned_setup_files(p_grace interval default '24 hours')
returns table (object_name text, owner_folder text, uploaded_at timestamptz)
language sql stable
security definer set search_path = public
as $$
  select o.name, split_part(o.name, '/', 1), o.created_at
  from storage.objects as o
  where o.bucket_id = 'setup-files'
    -- The grace window keeps in-flight uploads (row insert may still be coming)
    -- out of the result.
    and o.created_at < now() - p_grace
    and not exists (
      select 1 from public.setups as s
      where s.file_path = o.name
         or s.telemetry_file_path = o.name
    )
    -- Version snapshots keep historical file paths for moderation/audit even
    -- though the UI only renders the filename, so a referenced-in-history object
    -- is not garbage.
    and not exists (
      select 1 from public.setup_versions as v
      where v.file_path = o.name
         or v.telemetry_file_path = o.name
    )
$$;

-- Every object under one account's folder -- the list an operator needs to
-- delete alongside a completed account-deletion request.
create or replace function public.setup_files_for_user(p_user_id uuid)
returns table (object_name text, uploaded_at timestamptz)
language sql stable
security definer set search_path = public
as $$
  select o.name, o.created_at
  from storage.objects as o
  where o.bucket_id = 'setup-files'
    and split_part(o.name, '/', 1) = p_user_id::text
$$;

revoke all on function public.orphaned_setup_files(interval) from public, anon, authenticated;
revoke all on function public.setup_files_for_user(uuid) from public, anon, authenticated;
grant execute on function public.orphaned_setup_files(interval) to service_role;
grant execute on function public.setup_files_for_user(uuid) to service_role;
