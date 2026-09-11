-- Regression coverage for 0027_most_wanted_requests.sql: the aggregate must
-- count open requests inside the rolling window, ignore answered ones, ignore
-- stale ones, and keep grouping per (game, car, track).

insert into auth.users (id, email, raw_user_meta_data)
values ('77777777-7777-4777-8777-777777777777', 'mostwanted@example.com',
        '{"full_name":"demand"}'::jsonb);

-- Pin the caller identity: 0021's request rate-limit trigger counts inserts for
-- auth.uid(), and the other test files leave their own value behind here.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select '77777777-7777-4777-8777-777777777777'::uuid $$;

-- Four requests for the same combo: three recent+open (counted), one open but
-- outside the 90-day window (ignored), plus one recently answered (ignored).
insert into public.setup_requests (requester_id, game, car, track, notes, created_at) values
  ('77777777-7777-4777-8777-777777777777', 'iRacing', 'GC Testcar', 'GC Raceway', 'one',
   now() - interval '2 days'),
  ('77777777-7777-4777-8777-777777777777', 'iRacing', 'GC Testcar', 'GC Raceway', 'two',
   now() - interval '1 days'),
  ('77777777-7777-4777-8777-777777777777', 'iRacing', 'GC Testcar', 'GC Raceway', 'three',
   now() - interval '1 hours'),
  ('77777777-7777-4777-8777-777777777777', 'iRacing', 'GC Testcar', 'GC Raceway', 'stale',
   now() - interval '120 days');

-- A second combo with a single request, to prove the grouping is per combo.
insert into public.setup_requests (requester_id, game, car, track, notes)
values ('77777777-7777-4777-8777-777777777777', 'iRacing', 'GC Testcar', 'GC Sprint', 'alone');

\echo 'CHECK 1: most-wanted counts open requests inside the window only'
do $$
declare
  v_count integer;
begin
  select request_count into v_count
    from public.setup_requests_most_wanted
    where car = 'GC Testcar' and track = 'GC Raceway';

  if v_count is distinct from 3 then
    raise exception 'REGRESSION: expected 3 requests in the window, got %',
      coalesce(v_count::text, 'no row');
  end if;
  raise notice 'CHECK 1 passed';
end $$;

\echo 'CHECK 2: oldest_request_at ignores the out-of-window row'
do $$
declare
  v_oldest timestamptz;
begin
  select oldest_request_at into v_oldest
    from public.setup_requests_most_wanted
    where car = 'GC Testcar' and track = 'GC Raceway';

  if v_oldest < now() - interval '90 days' then
    raise exception 'REGRESSION: oldest_request_at leaked a request outside the window';
  end if;
  raise notice 'CHECK 2 passed';
end $$;

\echo 'CHECK 3: an answered request drops out of the demand signal'
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.setup_requests_most_wanted
    where car = 'GC Testcar' and track = 'GC Sprint';

  if v_count <> 1 then
    raise exception 'REGRESSION: expected the combo to aggregate into exactly one row, got %', v_count;
  end if;

  -- Now answer it: the combo must vanish from the board entirely.
  update public.setup_requests
    set fulfilled_by = '77777777-7777-4777-8777-777777777777', fulfilled_at = now(),
        fulfilled_setup_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    where car = 'GC Testcar' and track = 'GC Sprint';

  if exists (
    select 1 from public.setup_requests_most_wanted
    where car = 'GC Testcar' and track = 'GC Sprint'
  ) then
    raise exception 'REGRESSION: a fulfilled request still counts toward Most wanted';
  end if;
  raise notice 'CHECK 3 passed';
end $$;

\echo 'Most-wanted aggregate checks passed.'
