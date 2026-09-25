-- Regression coverage for 0030_garage_private_workflow.sql. This verifies
-- private ownership through the parent session, anonymous denial, the atomic
-- session+baseline RPC, and session-delete cascades using real non-superuser
-- API roles in the migration harness.

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'garage-a@example.com', '{"full_name":"Garage A"}'),
  ('22222222-2222-4222-8222-222222222222', 'garage-b@example.com', '{"full_name":"Garage B"}');

-- Approximate Supabase's request JWT claim for this vanilla-Postgres test
-- harness. Policies still execute as anon/authenticated, not as the owner.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

insert into public.garage_sessions
  (id, user_id, game, car, track, condition, rig)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111',
   'Assetto Corsa Competizione', 'BMW M4 GT3', 'Monza', 'Dry', null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222',
   'Le Mans Ultimate', 'Porsche 963', 'Le Mans', 'Wet', 'Wheel + 3 Pedals');

insert into public.garage_revisions (id, session_id, setup_values, note)
values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}'::jsonb, 'A baseline'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '{}'::jsonb, 'B baseline');

insert into public.garage_run_plan_items
  (id, session_id, revision_id, parameter, direction, amount, verdict, note)
values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Rear wing', 'increase', '1 click', 'better', 'stable');

insert into public.garage_laps
  (id, session_id, revision_id, lap_time_ms, condition, note)
values
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 102350, 'Dry', 'clean lap');

\echo 'CHECK 1: authenticated session creation stores its baseline atomically'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$
begin
  begin
    insert into public.garage_sessions (user_id, game, car, track, condition)
    values ('11111111-1111-4111-8111-111111111111', 'Assetto Corsa Competizione', 'Direct insert', 'Monza', 'Dry');
    raise exception 'REGRESSION: authenticated client inserted a session without its baseline';
  exception when insufficient_privilege then
    raise notice 'Direct session insert denied; use the atomic RPC';
  end;
end $$;
do $$
declare
  before_count integer;
  after_count integer;
begin
  select count(*) into before_count from public.garage_sessions
  where user_id = '11111111-1111-4111-8111-111111111111';

  begin
    perform public.create_garage_session_with_baseline(
      'Assetto Corsa Competizione', 'Invalid baseline', 'Monza', 'Dry', null, '[]'::jsonb, 'must rollback'
    );
    raise exception 'REGRESSION: session RPC accepted a non-object baseline';
  exception when check_violation then
    raise notice 'Invalid baseline rejected';
  end;

  select count(*) into after_count from public.garage_sessions
  where user_id = '11111111-1111-4111-8111-111111111111';
  if after_count <> before_count then
    raise exception 'REGRESSION: failed atomic RPC left a garage session behind';
  end if;
end $$;
select public.create_garage_session_with_baseline(
  'Assetto Corsa Competizione', 'Audi R8 LMS GT3', 'Spa-Francorchamps',
  'Dry', null, '{}'::jsonb, 'RPC baseline'
) as session_id \gset garage_
select (
  exists (
    select 1 from public.garage_sessions
    where id = :'garage_session_id'::uuid
      and user_id = '11111111-1111-4111-8111-111111111111'
  )
  and exists (
    select 1 from public.garage_revisions
    where session_id = :'garage_session_id'::uuid and note = 'RPC baseline'
  )
) as rpc_baseline_ok \gset
\if :rpc_baseline_ok
  \echo 'CHECK 1 passed'
\else
  \echo 'REGRESSION: session RPC did not create both owned rows'
  \quit 1
\endif
rollback;

\echo 'CHECK 2: User A cannot read User B sessions or revisions or insert a lap there'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$
begin
  if exists (
    select 1 from public.garage_sessions
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ) then
    raise exception 'REGRESSION: User A read User B session';
  end if;
  if exists (
    select 1 from public.garage_revisions
    where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ) then
    raise exception 'REGRESSION: User A read User B revision';
  end if;

  begin
    insert into public.garage_revisions (session_id, setup_values, note)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '{}'::jsonb, 'unauthorized');
    raise exception 'REGRESSION: User A inserted a revision into User B session';
  exception when insufficient_privilege then
    raise notice 'User A cannot insert a revision into User B session';
  end;

  begin
    insert into public.garage_run_plan_items
      (session_id, revision_id, parameter, direction, amount, verdict)
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'Rear wing', 'increase', '1 click', 'better'
    );
    raise exception 'REGRESSION: User A inserted a run-plan item into User B session';
  exception when insufficient_privilege then
    raise notice 'User A cannot insert a run-plan item into User B session';
  end;

  begin
    insert into public.garage_laps (session_id, revision_id, lap_time_ms, condition, note)
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      103000, 'Wet', 'unauthorized'
    );
    raise exception 'REGRESSION: User A inserted a lap into User B session';
  exception when insufficient_privilege then
    raise notice 'User A cannot insert into User B session';
  end;
end $$;
rollback;

\echo 'CHECK 3: anonymous users cannot read or write Garage data'
begin;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform 1 from public.garage_sessions limit 1;
    raise exception 'REGRESSION: anonymous role read garage sessions';
  exception when insufficient_privilege then
    raise notice 'Anonymous read denied';
  end;

  begin
    insert into public.garage_laps (session_id, revision_id, lap_time_ms, condition, note)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      103000, 'Dry', 'anonymous'
    );
    raise exception 'REGRESSION: anonymous role inserted a garage lap';
  exception when insufficient_privilege then
    raise notice 'Anonymous write denied';
  end;

  begin
    perform public.create_garage_session_with_baseline(
      'Assetto Corsa Competizione', 'Anonymous', 'Monza', 'Dry', null, '{}'::jsonb, 'anonymous'
    );
    raise exception 'REGRESSION: anonymous role called the session RPC';
  exception when insufficient_privilege then
    raise notice 'Anonymous RPC denied';
  end;
end $$;
rollback;

\echo 'CHECK 4: deleting a session cascades to its revisions, run-plan items, and laps'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$
declare
  deleted_count integer;
begin
  delete from public.garage_sessions
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics deleted_count = row_count;
  if deleted_count <> 1 then
    raise exception 'REGRESSION: User A could not delete their own session';
  end if;
end $$;
commit;
reset role;

do $$
begin
  if exists (select 1 from public.garage_revisions where session_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'REGRESSION: session deletion left a revision';
  end if;
  if exists (select 1 from public.garage_run_plan_items where session_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'REGRESSION: session deletion left a run-plan item';
  end if;
  if exists (select 1 from public.garage_laps where session_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'REGRESSION: session deletion left a lap';
  end if;
end $$;

\echo 'Garage RLS and cascade checks passed.'
