-- Regression coverage for 0016_fulfill_request_hardening.sql, run against a
-- throwaway database by scripts/test-db.sh (see that script for how to run
-- this locally or in CI). Exercises the exact scenarios that were verified
-- by hand before 0016 was written: a mismatched-setup fulfillment attempt,
-- a correct fulfillment, a double-fulfillment attempt, the notification
-- (and its self-fulfillment exclusion), the reopen-on-delete trigger, and
-- the comment length constraint from the same migration.
--
-- Each check either lets an unexpected outcome propagate as a real error
-- (psql -v ON_ERROR_STOP=1 then fails the whole script/job), or explicitly
-- raises when an expected error DIDN'T happen -- either way, a regression
-- here means this script exits non-zero.

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');
-- profiles rows are auto-created by the handle_new_user() trigger from
-- 0001; just give them readable usernames.
update public.profiles set username = 'alice' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set username = 'bob' where id = '22222222-2222-2222-2222-222222222222';

insert into public.setup_requests (id, requester_id, game, car, track, notes)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
        'iRacing', 'Porsche 992 GT3 Cup', 'Spa-Francorchamps', 'need a wet setup');

-- Alice owns two setups: one matching Bob's request, one totally unrelated.
insert into public.setups (id, user_id, game, car, track, condition, description, tags, rig_profile)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
   'iRacing', 'Porsche 992 GT3 Cup', 'Spa-Francorchamps', 'Dry', 'test', '{}', 'Wheel + 3 Pedals'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'Gran Turismo 7', 'Toyota GR86', 'Suzuka', 'Dry', 'unrelated', '{}', 'Wheel + 3 Pedals');

create or replace function auth.uid() returns uuid language sql stable as
  $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;

\echo 'CHECK 1: fulfilling with a game/car/track mismatch must be rejected'
do $$
begin
  perform public.fulfill_setup_request('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
  raise exception 'REGRESSION: fulfill_setup_request accepted an unrelated setup for this request';
exception when others then
  -- Our own synthetic failure above must always propagate, checked before
  -- the expected-error pattern match -- otherwise a coincidental substring
  -- overlap between the two messages can make a real regression register
  -- as a false pass (this bit us during development of this very check).
  if sqlerrm like 'REGRESSION:%' then raise; end if;
  if sqlerrm !~ 'does not match' then raise; end if;
  raise notice 'CHECK 1 passed: %', sqlerrm;
end $$;

\echo 'CHECK 2: fulfilling with the matching setup must succeed'
select public.fulfill_setup_request('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
do $$
declare
  v_fulfilled_setup_id uuid;
  v_fulfilled_by uuid;
  v_fulfilled_at timestamptz;
begin
  select fulfilled_setup_id, fulfilled_by, fulfilled_at
    into v_fulfilled_setup_id, v_fulfilled_by, v_fulfilled_at
    from public.setup_requests where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if v_fulfilled_setup_id is distinct from 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
     or v_fulfilled_by is distinct from '11111111-1111-1111-1111-111111111111'::uuid
     or v_fulfilled_at is null then
    raise exception 'REGRESSION: fulfill_setup_request did not correctly record the fulfillment';
  end if;
  raise notice 'CHECK 2 passed';
end $$;

\echo 'CHECK 3: fulfilling an already-fulfilled request must be rejected (TOCTOU fix)'
do $$
begin
  perform public.fulfill_setup_request('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  raise exception 'REGRESSION: fulfill_setup_request allowed a second fulfillment of the same request';
exception when others then
  if sqlerrm like 'REGRESSION:%' then raise; end if;
  if sqlerrm !~ 'already been fulfilled' then raise; end if;
  raise notice 'CHECK 3 passed: %', sqlerrm;
end $$;

\echo 'CHECK 4: a request_fulfilled notification must be created for the requester, not the fulfiller'
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.notifications
    where type = 'request_fulfilled'
      and user_id = '22222222-2222-2222-2222-222222222222'
      and actor_id = '11111111-1111-1111-1111-111111111111';
  if v_count <> 1 then
    raise exception 'REGRESSION: expected exactly one request_fulfilled notification for the requester, found %', v_count;
  end if;
  raise notice 'CHECK 4 passed';
end $$;

\echo 'CHECK 5: deleting the fulfilling setup must clear fulfilled_by/fulfilled_at, not just fulfilled_setup_id (reopen trigger)'
delete from public.setups where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
do $$
declare
  v_fulfilled_setup_id uuid;
  v_fulfilled_by uuid;
  v_fulfilled_at timestamptz;
begin
  select fulfilled_setup_id, fulfilled_by, fulfilled_at
    into v_fulfilled_setup_id, v_fulfilled_by, v_fulfilled_at
    from public.setup_requests where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if v_fulfilled_setup_id is not null or v_fulfilled_by is not null or v_fulfilled_at is not null then
    raise exception 'REGRESSION: deleting the fulfilling setup left stale fulfilled_by/fulfilled_at behind';
  end if;
  raise notice 'CHECK 5 passed';
end $$;

\echo 'CHECK 6: fulfilling your own request must not notify yourself'
insert into public.setup_requests (id, requester_id, game, car, track, notes)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111',
        'Gran Turismo 7', 'Toyota GR86', 'Suzuka', 'my own request');
select public.fulfill_setup_request('dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.notifications
    where type = 'request_fulfilled'
      and user_id = '11111111-1111-1111-1111-111111111111'
      and actor_id = '11111111-1111-1111-1111-111111111111';
  if v_count <> 0 then
    raise exception 'REGRESSION: self-fulfillment created a self-notification';
  end if;
  raise notice 'CHECK 6 passed';
end $$;

\echo 'CHECK 7: comment bodies over 1000 characters must be rejected at the DB level'
do $$
begin
  insert into public.setup_comments (setup_id, user_id, body)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', repeat('x', 1001));
  raise exception 'REGRESSION: setup_comments accepted an over-length body';
exception when others then
  if sqlerrm like 'REGRESSION:%' then raise; end if;
  if sqlerrm !~ 'setup_comments_body_length' then raise; end if;
  raise notice 'CHECK 7 passed: %', sqlerrm;
end $$;

\echo 'All checks passed.'
