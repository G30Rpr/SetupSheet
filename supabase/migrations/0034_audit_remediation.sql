-- 0034_audit_remediation.sql
-- Addresses critical findings and warnings from the Supabase + PostgreSQL audit:
--
-- 1. (C-1) handle_new_user() idempotency: adds ON CONFLICT DO UPDATE so auth
--    retries or duplicate user inserts do not abort user registration with
--    a primary key conflict.
-- 2. (C-2) Foreign key and GC indexes: indexes referencing columns on
--    setup_upvotes, setup_ratings, setup_favorites, notifications,
--    setup_requests, setup_comments, and field_test_reports to prevent full
--    table scans and lock escalation during cascading deletes. Also indexes
--    file_path and telemetry_file_path for orphaned_setup_files() retention GC.
-- 3. (W-2) Least privilege: revokes unnecessary CREATE on schema public from
--    the setupsheet_garage_writer service role.
-- 4. (W-3, S-1) Recompute & delete optimization: single-scan aggregation in
--    recompute_setup_rating() and cascade-delete existence guards in both
--    recompute_setup_rating() and handle_upvote_delete() to prevent 100s of
--    redundant UPDATEs when a setup is deleted.
-- 5. (W-5) Self-upvote prevention: enforces auth.uid() <> setup.user_id on
--    setup_upvotes insertion via RLS.
-- 6. (W-1) increment_downloads hardening: converts to PL/pgSQL with NULL check.

-- ============================================================================
-- 1. Auth profile creation idempotency
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_username text;
  v_avatar_url text;
begin
  v_username := left(
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'user_name'), ''),
      nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
      'Racer'
    ),
    80
  );
  v_avatar_url := new.raw_user_meta_data ->> 'avatar_url';

  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(nullif(v_username, ''), 'Racer'),
    case when v_avatar_url ~* '^https://' then left(v_avatar_url, 2048) else null end
  )
  on conflict (id) do update set
    username = coalesce(nullif(excluded.username, ''), public.profiles.username),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

-- ============================================================================
-- 2. Foreign key and retention lookup indexes
-- ============================================================================

-- Fast cascade delete and setup lookup for upvotes
create index if not exists setup_upvotes_setup_id_idx
  on public.setup_upvotes (setup_id);

-- Fast aggregation and cascade delete for ratings
create index if not exists setup_ratings_setup_id_idx
  on public.setup_ratings (setup_id);

-- Fast cascade delete for favorites
create index if not exists setup_favorites_setup_id_idx
  on public.setup_favorites (setup_id);

-- Fast actor profile delete and setup delete for notifications
create index if not exists notifications_actor_id_idx
  on public.notifications (actor_id);

create index if not exists notifications_setup_id_idx
  on public.notifications (setup_id)
  where setup_id is not null;

-- Fast profile cascade and setup cascade for requests
create index if not exists setup_requests_requester_id_idx
  on public.setup_requests (requester_id);

create index if not exists setup_requests_fulfilled_setup_id_idx
  on public.setup_requests (fulfilled_setup_id)
  where fulfilled_setup_id is not null;

create index if not exists setup_requests_fulfilled_by_idx
  on public.setup_requests (fulfilled_by)
  where fulfilled_by is not null;

-- Fast profile cascade for comments
create index if not exists setup_comments_user_id_idx
  on public.setup_comments (user_id);

-- Fast session cascade delete for field-test reports
create index if not exists field_test_reports_garage_session_id_idx
  on public.field_test_reports (garage_session_id);

-- Fast orphaned_setup_files() retention GC lookups
create index if not exists setups_file_path_idx
  on public.setups (file_path)
  where file_path is not null;

create index if not exists setups_telemetry_file_path_idx
  on public.setups (telemetry_file_path)
  where telemetry_file_path is not null;

create index if not exists setup_versions_file_path_idx
  on public.setup_versions (file_path)
  where file_path is not null;

create index if not exists setup_versions_telemetry_file_path_idx
  on public.setup_versions (telemetry_file_path)
  where telemetry_file_path is not null;

-- ============================================================================
-- 3. Least privilege: revoke CREATE on public schema from garage writer role
-- ============================================================================

revoke create on schema public from setupsheet_garage_writer;

-- ============================================================================
-- 4. Single-scan rating recompute + cascade delete guards
-- ============================================================================

create or replace function public.recompute_setup_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_setup_id uuid := coalesce(new.setup_id, old.setup_id);
  v_pace numeric(2,1);
  v_predictability numeric(2,1);
  v_count integer;
begin
  -- If target setup no longer exists (e.g. during a cascade delete), skip
  if not exists (select 1 from public.setups where id = target_setup_id) then
    return null;
  end if;

  select
    coalesce(round(avg(pace), 1), 0),
    coalesce(round(avg(predictability), 1), 0),
    count(*)::integer
  into v_pace, v_predictability, v_count
  from public.setup_ratings
  where setup_id = target_setup_id;

  update public.setups
  set
    pace = v_pace,
    predictability = v_predictability,
    rating_count = v_count
  where id = target_setup_id;

  return null;
end;
$$;

create or replace function public.handle_upvote_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (select 1 from public.setups where id = old.setup_id) then
    update public.setups set upvotes = greatest(upvotes - 1, 0) where id = old.setup_id;
  end if;
  return old;
end;
$$;

-- ============================================================================
-- 5. Disallow self-upvoting via RLS
-- ============================================================================

drop policy if exists "Users can upvote as themselves" on public.setup_upvotes;

create policy "Users can upvote as themselves"
  on public.setup_upvotes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and auth.uid() <> (select s.user_id from public.setups s where s.id = setup_id)
  );

-- ============================================================================
-- 6. Harden increment_downloads counter helper
-- ============================================================================

create or replace function public.increment_downloads(setup_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if setup_id is null then
    return;
  end if;

  update public.setups as s
    set downloads = s.downloads + 1
    where s.id = setup_id;
end;
$$;
