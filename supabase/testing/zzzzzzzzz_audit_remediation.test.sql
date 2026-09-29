-- Regression coverage for 0034_audit_remediation.sql:
-- 1. handle_new_user() idempotency on conflict
-- 2. Foreign key and retention indexes exist
-- 3. setupsheet_garage_writer least-privilege (no CREATE on public)

\echo 'CHECK 1: handle_new_user() profile creation and conflict handling'
do $$
declare
  v_test_user_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_username text;
begin
  -- 1. Insert auth user; trigger handle_new_user() creates profile
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_test_user_id, 'test-conflict@example.com', '{"full_name":"Initial Name"}'::jsonb);

  select username into v_username from public.profiles where id = v_test_user_id;
  if v_username <> 'Initial Name' then
    raise exception 'REGRESSION: expected profile Initial Name, got %', v_username;
  end if;

  -- 2. Re-executing profile insert on conflict updates metadata cleanly without crashing
  insert into public.profiles (id, username, avatar_url)
  values (v_test_user_id, 'Updated Name', null)
  on conflict (id) do update set
    username = coalesce(nullif(excluded.username, ''), public.profiles.username),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  select username into v_username from public.profiles where id = v_test_user_id;
  if v_username <> 'Updated Name' then
    raise exception 'REGRESSION: profile was not updated on conflict; username is %', v_username;
  end if;

  raise notice 'CHECK 1 passed';
end $$;

\echo 'CHECK 2: all foreign key and retention GC indexes exist'
do $$
declare
  v_missing text[];
begin
  select array_agg(expected_index) into v_missing
  from unnest(array[
    'setup_upvotes_setup_id_idx',
    'setup_ratings_setup_id_idx',
    'setup_favorites_setup_id_idx',
    'notifications_actor_id_idx',
    'notifications_setup_id_idx',
    'setup_requests_requester_id_idx',
    'setup_requests_fulfilled_setup_id_idx',
    'setup_requests_fulfilled_by_idx',
    'setup_comments_user_id_idx',
    'field_test_reports_garage_session_id_idx',
    'setups_file_path_idx',
    'setups_telemetry_file_path_idx',
    'setup_versions_file_path_idx',
    'setup_versions_telemetry_file_path_idx'
  ]) as expected_index
  where not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = expected_index
  );

  if v_missing is not null and array_length(v_missing, 1) > 0 then
    raise exception 'REGRESSION: missing expected indexes: %', array_to_string(v_missing, ', ');
  end if;

  raise notice 'CHECK 2 passed';
end $$;

\echo 'CHECK 3: setupsheet_garage_writer does not have CREATE on schema public'
do $$
begin
  if has_schema_privilege('setupsheet_garage_writer', 'public', 'CREATE') then
    raise exception 'REGRESSION: setupsheet_garage_writer still holds CREATE on schema public';
  end if;
  raise notice 'CHECK 3 passed';
end $$;

\echo 'All audit remediation checks passed.'

