-- Regression coverage for 0030_garage_private_workflow.sql,
-- 0031_garage_start_from_setup.sql, and 0032_field_test_reports.sql. This
-- verifies private ownership through the parent session, anonymous denial,
-- server-derived field-test eligibility and metrics, public projection privacy,
-- attribution, owner notification, uniqueness, and session-delete cascades
-- using real non-superuser API roles in the migration harness.

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'garage-a@example.com', '{"full_name":"Garage A"}'),
  ('22222222-2222-4222-8222-222222222222', 'garage-b@example.com', '{"full_name":"Garage B"}');

update public.profiles set username = 'Field Tester A'
where id = '11111111-1111-4111-8111-111111111111';

insert into public.setups
  (id, user_id, game, car, track, condition, description, tags, rig_profile)
values
  ('99999999-9999-4999-8999-999999999999', '11111111-1111-4111-8111-111111111111',
   'Assetto Corsa Competizione', 'BMW M4 GT3', 'Monza', 'Wet', 'public source setup', '{}', 'Wheel + 3 Pedals'),
  ('88888888-8888-4888-8888-888888888888', '11111111-1111-4111-8111-111111111111',
   'Gran Turismo 7', 'Toyota GR86', 'Suzuka', 'Dry', 'unsupported Garage source', '{}', 'Gamepad'),
  ('77777777-7777-4777-8777-777777777777', '22222222-2222-4222-8222-222222222222',
   'Assetto Corsa Competizione', 'McLaren 720S GT3', 'Spa-Francorchamps', 'Dry', 'field-test source', '{}', 'Wheel + 3 Pedals');

-- Approximate Supabase's request JWT claim for this vanilla-Postgres test
-- harness. Policies still execute as anon/authenticated, not as the owner.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

insert into public.garage_sessions
  (id, user_id, game, car, track, condition, rig, source_setup_id)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111',
   'Assetto Corsa Competizione', 'BMW M4 GT3', 'Monza', 'Dry', null, null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222',
   'Le Mans Ultimate', 'Porsche 963', 'Le Mans', 'Wet', 'Wheel + 3 Pedals', null),
  ('12121212-1212-4121-8121-121212121212', '11111111-1111-4111-8111-111111111111',
   'Assetto Corsa Competizione', 'McLaren 720S GT3', 'Spa-Francorchamps', 'Dry', null,
   '77777777-7777-4777-8777-777777777777'),
  ('14141414-1414-4141-8141-141414141414', '11111111-1111-4111-8111-111111111111',
   'Assetto Corsa Competizione', 'BMW M4 GT3', 'Monza', 'Dry', null,
   '99999999-9999-4999-8999-999999999999'),
  ('24242424-2424-4242-8242-242424242424', '11111111-1111-4111-8111-111111111111',
   'Assetto Corsa Competizione', 'McLaren 720S GT3', 'Spa-Francorchamps', 'Dry', null,
   '77777777-7777-4777-8777-777777777777'),
  ('25252525-2525-4252-8252-252525252525', '11111111-1111-4111-8111-111111111111',
   'Assetto Corsa Competizione', 'McLaren 720S GT3', 'Spa-Francorchamps', 'Dry', null,
   '77777777-7777-4777-8777-777777777777');

insert into public.garage_revisions (id, session_id, setup_values, note)
values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}'::jsonb, 'A baseline'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '{}'::jsonb, 'B baseline'),
  ('15151515-1515-4151-8151-151515151515', '12121212-1212-4121-8121-121212121212', '{}'::jsonb, 'Field-test baseline'),
  ('16161616-1616-4161-8161-161616161616', '14141414-1414-4141-8141-141414141414', '{}'::jsonb, 'One-lap baseline'),
  ('26262626-2626-4262-8262-262626262626', '25252525-2525-4252-8252-252525252525', '{}'::jsonb, 'No-better baseline');

insert into public.garage_run_plan_items
  (id, session_id, revision_id, parameter, direction, amount, verdict, note)
values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Rear wing', 'increase', '1 click', 'better', 'stable'),
  ('17171717-1717-4171-8171-171717171717', '12121212-1212-4121-8121-121212121212',
   '15151515-1515-4151-8151-151515151515', 'Rear wing', 'increase', '1 click', 'better', 'stable'),
  ('18181818-1818-4181-8181-181818181818', '12121212-1212-4121-8121-121212121212',
   '15151515-1515-4151-8151-151515151515', 'Brake bias', 'decrease', '0.5%', 'worse', 'less stable'),
  ('19191919-1919-4191-8191-191919191919', '14141414-1414-4141-8141-141414141414',
   '16161616-1616-4161-8161-161616161616', 'Brake bias', 'decrease', '0.5%', 'better', 'good'),
  ('27272727-2727-4272-8272-272727272727', '25252525-2525-4252-8252-252525252525',
   '26262626-2626-4262-8262-262626262626', 'Brake bias', 'decrease', '0.5%', 'worse', 'worse');

insert into public.garage_laps
  (id, session_id, revision_id, lap_time_ms, condition, note)
values
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 102350, 'Dry', 'clean lap'),
  ('20202020-2020-4202-8202-202020202020', '12121212-1212-4121-8121-121212121212',
   '15151515-1515-4151-8151-151515151515', 100000, 'Dry', 'dry lap'),
  ('21212121-2121-4212-8212-212121212121', '12121212-1212-4121-8121-121212121212',
   '15151515-1515-4151-8151-151515151515', 101000, 'Wet', 'wet lap'),
  ('23232323-2323-4232-8232-232323232323', '14141414-1414-4141-8141-141414141414',
   '16161616-1616-4161-8161-161616161616', 99000, 'Wet', 'one wet lap'),
  ('28282828-2828-4282-8282-282828282828', '25252525-2525-4252-8252-252525252525',
   '26262626-2626-4262-8262-262626262626', 103000, 'Dry', 'lap but no better change');

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

select public.create_garage_session_from_setup_with_baseline(
  '99999999-9999-4999-8999-999999999999', 'Gamepad', '{"brakeBias":"56% front"}'::jsonb, 'Source baseline'
) as session_id \gset garage_source_
select (
  exists (
    select 1 from public.garage_sessions
    where id = :'garage_source_session_id'::uuid
      and user_id = '11111111-1111-4111-8111-111111111111'
      and source_setup_id = '99999999-9999-4999-8999-999999999999'
      and game = 'Assetto Corsa Competizione'
      and car = 'BMW M4 GT3'
      and track = 'Monza'
      and condition = 'Wet'
      and rig = 'Gamepad'
  )
  and exists (
    select 1 from public.garage_revisions
    where session_id = :'garage_source_session_id'::uuid
      and setup_values = '{"brakeBias":"56% front"}'::jsonb
      and note = 'Source baseline'
  )
) as source_rpc_ok \gset
\if :source_rpc_ok
  \echo 'CHECK 1b passed: source metadata is read from the public setup row'
\else
  \echo 'REGRESSION: source RPC did not derive metadata or create its baseline'
  \quit 1
\endif

do $$
begin
  begin
    perform public.create_garage_session_from_setup_with_baseline(
      '88888888-8888-4888-8888-888888888888', null, '{}'::jsonb, 'unsupported source'
    );
    raise exception 'REGRESSION: source RPC accepted an unsupported game';
  exception when sqlstate '22023' then
    raise notice 'Unsupported source game rejected';
  end;
end $$;
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

  begin
    perform public.create_garage_session_from_setup_with_baseline(
      '99999999-9999-4999-8999-999999999999', null, '{}'::jsonb, 'anonymous source'
    );
    raise exception 'REGRESSION: anonymous role called the source setup RPC';
  exception when insufficient_privilege then
    raise notice 'Anonymous source setup RPC denied';
  end;

  begin
    perform public.create_field_test_report(
      '12121212-1212-4121-8121-121212121212',
      '77777777-7777-4777-8777-777777777777',
      'anonymous report'
    );
    raise exception 'REGRESSION: anonymous role called the field-test RPC';
  exception when insufficient_privilege then
    raise notice 'Anonymous field-test RPC denied';
  end;

  begin
    perform public.set_field_test_report_attribution(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true
    );
    raise exception 'REGRESSION: anonymous role changed field-test attribution';
  exception when insufficient_privilege then
    raise notice 'Anonymous attribution RPC denied';
  end;
end $$;
rollback;

\echo 'CHECK 5: field-test eligibility, derived metrics, UTC uniqueness, privacy, attribution, and owner notice'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

do $$
begin
  begin
    perform public.create_field_test_report(
      '24242424-2424-4242-8242-242424242424',
      '77777777-7777-4777-8777-777777777777',
      'no laps'
    );
    raise exception 'REGRESSION: field-test RPC accepted a session with no laps';
  exception when sqlstate '22023' then
    if sqlerrm <> 'Log at least one lap before submitting a field test' then raise; end if;
  end;

  begin
    perform public.create_field_test_report(
      '25252525-2525-4252-8252-252525252525',
      '77777777-7777-4777-8777-777777777777',
      'no better change'
    );
    raise exception 'REGRESSION: field-test RPC accepted no better run-plan result';
  exception when sqlstate '22023' then
    if sqlerrm <> 'Record at least one better run-plan result before submitting a field test' then raise; end if;
  end;

  begin
    perform public.create_field_test_report(
      '12121212-1212-4121-8121-121212121212',
      '99999999-9999-4999-8999-999999999999',
      'wrong setup'
    );
    raise exception 'REGRESSION: field-test RPC accepted a different source setup';
  exception when sqlstate '22023' then
    if sqlerrm <> 'Garage session was not started from this setup' then raise; end if;
  end;

  begin
    perform public.create_field_test_report(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '77777777-7777-4777-8777-777777777777',
      'other user session'
    );
    raise exception 'REGRESSION: User A created a report from User B session';
  exception when no_data_found then
    raise notice 'Cross-user Garage session rejected';
  end;

  begin
    perform 1 from public.field_test_reports limit 1;
    raise exception 'REGRESSION: authenticated client read private field-test rows directly';
  exception when insufficient_privilege then
    raise notice 'Private field-test table read denied';
  end;

  begin
    insert into public.field_test_reports
      (user_id, garage_session_id, setup_id, game, condition, validated_changes, laps_run, best_lap_ms)
    values (
      '11111111-1111-4111-8111-111111111111',
      '12121212-1212-4121-8121-121212121212',
      '77777777-7777-4777-8777-777777777777',
      'Assetto Corsa Competizione', 'Mixed', '[]'::jsonb, 2, 100000
    );
    raise exception 'REGRESSION: authenticated client inserted field-test metrics directly';
  exception when insufficient_privilege then
    raise notice 'Direct field-test insert denied';
  end;
end $$;

select public.create_field_test_report(
  '12121212-1212-4121-8121-121212121212',
  '77777777-7777-4777-8777-777777777777',
  'private context only'
) as report_id \gset field_test_
select public.create_field_test_report(
  '14141414-1414-4141-8141-141414141414',
  '99999999-9999-4999-8999-999999999999',
  'one lap private context'
) as report_id \gset field_test_one_lap_

do $$
begin
  begin
    perform public.create_field_test_report(
      '12121212-1212-4121-8121-121212121212',
      '77777777-7777-4777-8777-777777777777',
      'duplicate same UTC day'
    );
    raise exception 'REGRESSION: user created two reports for one setup/UTC day';
  exception when unique_violation then
    raise notice 'Duplicate user/setup/UTC-day report rejected atomically';
  end;
end $$;

-- A different owner cannot opt in on the report author's behalf.
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$
declare
  v_report_id uuid;
begin
  select report_id into v_report_id
    from public.field_test_reports_public
    where setup_id = '77777777-7777-4777-8777-777777777777';
  begin
    perform public.set_field_test_report_attribution(v_report_id, true);
    raise exception 'REGRESSION: another user changed report attribution';
  exception when no_data_found then
    raise notice 'Only the report author can change attribution';
  end;
end $$;

set local role anon;
select (
  exists (
    select 1 from public.field_test_reports_public
    where report_id = :'field_test_report_id'::uuid
      and setup_id = '77777777-7777-4777-8777-777777777777'
      and condition = 'Mixed'
      and laps_run = 2
      and consistency_pct = 99.3
      and best_lap_ms = 100000
      and jsonb_array_length(validated_changes) = 1
      and validated_changes -> 0 ->> 'parameter' = 'Rear wing'
      and display_name is null
  )
  and exists (
    select 1 from public.field_test_reports_public
    where report_id = :'field_test_one_lap_report_id'::uuid
      and condition = 'Wet'
      and laps_run = 1
      and consistency_pct is null
  )
  and (select report_count from public.field_test_counts
       where setup_id = '77777777-7777-4777-8777-777777777777') = 1
  and (select report_count from public.field_test_counts
       where setup_id = '99999999-9999-4999-8999-999999999999') = 1
  and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'field_test_reports_public'
      and column_name in ('user_id', 'garage_session_id', 'note', 'rig')
  )
) as public_projection_ok \gset
\if :public_projection_ok
  \echo 'Public projection and server-derived metrics passed'
\else
  \echo 'REGRESSION: public field-test projection leaked private data or metrics were incorrect'
  \quit 1
\endif

do $$
begin
  begin
    perform 1 from public.field_test_reports limit 1;
    raise exception 'REGRESSION: anonymous role read private field-test rows directly';
  exception when insufficient_privilege then
    raise notice 'Anonymous private-table read denied';
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select public.set_field_test_report_attribution(:'field_test_report_id'::uuid, true);
set local role anon;
select (
  exists (
    select 1 from public.field_test_reports_public
    where report_id = :'field_test_report_id'::uuid
      and display_name = 'Field Tester A'
  )
) as attribution_opt_in_ok \gset
\if :attribution_opt_in_ok
  \echo 'Explicit attribution opt-in passed'
\else
  \echo 'REGRESSION: explicit attribution opt-in was not reflected in the public view'
  \quit 1
\endif

set local role authenticated;
select public.set_field_test_report_attribution(:'field_test_report_id'::uuid, false);
set local role anon;
select (
  exists (
    select 1 from public.field_test_reports_public
    where report_id = :'field_test_report_id'::uuid
      and display_name is null
  )
) as attribution_opt_out_ok \gset
\if :attribution_opt_out_ok
  \echo 'Explicit attribution opt-out passed'
\else
  \echo 'REGRESSION: explicit attribution opt-out was not reflected in the public view'
  \quit 1
\endif

reset role;
select (
  exists (
    select 1 from public.notifications
    where user_id = '22222222-2222-4222-8222-222222222222'
      and actor_id = '11111111-1111-4111-8111-111111111111'
      and setup_id = '77777777-7777-4777-8777-777777777777'
      and field_test_report_id = :'field_test_report_id'::uuid
      and type = 'field_test'
  )
  and not exists (
    select 1 from public.notifications
    where field_test_report_id = :'field_test_one_lap_report_id'::uuid
  )
  and exists (
    select 1 from public.field_test_reports
    where id = :'field_test_report_id'::uuid
      and user_id = '11111111-1111-4111-8111-111111111111'
      and garage_session_id = '12121212-1212-4121-8121-121212121212'
      and report_day_utc = (now() at time zone 'UTC')::date
      and note = 'private context only'
  )
) as private_storage_and_notification_ok \gset
\if :private_storage_and_notification_ok
  \echo 'Private storage, UTC day, and owner notification passed'
\else
  \echo 'REGRESSION: private metadata, UTC day, or owner notification failed'
  \quit 1
\endif
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
