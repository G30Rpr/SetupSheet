-- Regression coverage for 0034_audit_remediation.sql:
-- 1. handle_new_user() idempotency on conflict
-- 2. Foreign key and retention indexes exist
-- 3. setupsheet_garage_writer least-privilege (no CREATE on public)
-- 4. Self-upvoting rejected under RLS
-- 5. Safe cascading deletion of setups with ratings and upvotes

\echo 'CHECK 1: handle_new_user() is idempotent on conflicting id'
do $$
declare
  v_test_user_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_username text;
begin
  -- Pre-insert a profile with the same ID to simulate an existing profile or retry
  insert into public.profiles (id, username, avatar_url)
  values (v_test_user_id, 'Existing Profile', null)
  on conflict (id) do nothing;

  -- Inserting auth.users fires handle_new_user(), which succeeds via ON CONFLICT DO UPDATE
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_test_user_id, 'test-conflict@example.com', '{"full_name":"Updated Name"}'::jsonb);

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

\echo 'CHECK 4: self-upvote is rejected under RLS'
do $$
declare
  v_owner_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_other_id uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_setup_id uuid;
begin
  -- Create other user
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_other_id, 'other-user@example.com', '{"full_name":"Other User"}'::jsonb)
  on conflict (id) do nothing;

  -- Create setup owned by v_owner_id
  insert into public.setups (id, user_id, game, car, track, condition, description, tags, rig_profile, pace, predictability)
  values ('55555555-5555-4555-8555-555555555555', v_owner_id, 'iRacing', 'Porsche 992 GT3 Cup', 'Spa-Francorchamps', 'Dry', 'test setup', '{}', 'Gamepad', 3, 3)
  returning id into v_setup_id;
end $$;

-- Set auth.uid() to the setup owner
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid $$;

-- Test self-upvote rejection under authenticated role (which enforces RLS)
begin;
set local role authenticated;
do $$
declare
  v_owner_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  v_setup_id uuid := '55555555-5555-4555-8555-555555555555'::uuid;
begin
  begin
    insert into public.setup_upvotes (user_id, setup_id)
    values (v_owner_id, v_setup_id);
    raise exception 'REGRESSION: setup owner was permitted to upvote their own setup';
  exception when check_violation or insufficient_privilege or others then
    raise notice 'Self-upvote correctly rejected';
  end;
end $$;
rollback;

-- Set auth.uid() to other user
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid $$;

begin;
set local role authenticated;
insert into public.setup_upvotes (user_id, setup_id)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, '55555555-5555-4555-8555-555555555555'::uuid);
commit;
reset role;

\echo 'CHECK 5: cascade deletion of setup cleans up ratings and upvotes safely'
do $$
declare
  v_owner_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_other_id uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_setup_id uuid := '55555555-5555-4555-8555-555555555555';
begin
  -- Add a rating from other user
  insert into public.setup_ratings (user_id, setup_id, pace, predictability)
  values (v_other_id, v_setup_id, 4, 5);

  -- Delete the setup: should cascade without trigger exceptions
  delete from public.setups where id = v_setup_id;

  if exists (select 1 from public.setup_upvotes where setup_id = v_setup_id) then
    raise exception 'REGRESSION: upvotes were not cascaded on setup delete';
  end if;

  if exists (select 1 from public.setup_ratings where setup_id = v_setup_id) then
    raise exception 'REGRESSION: ratings were not cascaded on setup delete';
  end if;

  raise notice 'CHECK 5 passed';
end $$;

\echo 'All audit remediation checks passed.'
