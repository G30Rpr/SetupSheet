-- Regression coverage for 0037_rater_rig.sql. The rater's rig must stay a
-- clean, optional attribute and the split aggregates must match the trust
-- rules (author self-ratings excluded), never leaking per-rater rows:
--   CHECK 1: an invalid rater_rig is rejected by the database
--   CHECK 2: valid and null rater_rig values both store cleanly
--   CHECK 3: get_setup_rating_splits excludes author self-ratings
--   CHECK 4: the RPC groups by rig and is callable by anonymous visitors

-- Actors (fresh c0a0000{5..8} ids so we don't collide with zz_rating_trust):
-- the author of setup cccc07..., and another racer.
insert into auth.users (id, email, raw_user_meta_data) values
  ('c0a00005-0000-4000-8000-000000000005', 'rig-author@test.local', '{}'),
  ('c0a00006-0000-4000-8000-000000000006', 'rig-rater@test.local', '{}')
on conflict (id) do nothing;

create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'c0a00005-0000-4000-8000-000000000005'::uuid $$;

insert into public.profiles (id, username) values
  ('c0a00005-0000-4000-8000-000000000005', 'rigauthor'),
  ('c0a00006-0000-4000-8000-000000000006', 'rigrater')
on conflict (id) do nothing;

insert into public.setups
  (id, user_id, game, car, track, condition, description, tags, rig_profile)
values
  ('c0a00007-0000-4000-8000-000000000007', 'c0a00005-0000-4000-8000-000000000005',
   'Assetto Corsa Competizione', 'BMW M4 GT3 2021', 'Spa-Francorchamps', 'Dry',
   'rig split setup', '{}'::text[], 'Wheel + 3 Pedals');

\echo 'CHECK 1: an invalid rater_rig is rejected'
do $$
begin
  insert into public.setup_ratings (user_id, setup_id, pace, predictability, rater_rig)
  values ('c0a00006-0000-4000-8000-000000000006', 'c0a00007-0000-4000-8000-000000000007', 4, 2, 'Steering Wheel Only');
  raise exception 'REGRESSION: invalid rater_rig was accepted';
exception when check_violation then
  raise notice 'CHECK 1 passed: invalid rater_rig rejected';
end $$;

\echo 'CHECK 2: valid and null rater_rig values both store'
do $$
begin
  insert into public.setup_ratings (user_id, setup_id, pace, predictability, rater_rig)
  values ('c0a00006-0000-4000-8000-000000000006', 'c0a00007-0000-4000-8000-000000000007', 4, 2, 'Gamepad');
  insert into public.setup_ratings (user_id, setup_id, pace, predictability, rater_rig)
  values ('c0a00006-0000-4000-8000-000000000006', 'c0a00007-0000-4000-8000-000000000007', 4, 2, null)
    on conflict (user_id, setup_id) do update set rater_rig = excluded.rater_rig;
  if (select rater_rig from public.setup_ratings
      where user_id = 'c0a00006-0000-4000-8000-000000000006'
        and setup_id = 'c0a00007-0000-4000-8000-000000000007') is not null then
    raise exception 'REGRESSION: null rater_rig did not store';
  end if;
  raise notice 'CHECK 2 passed: rater_rig stores and nulls';
end $$;

\echo 'CHECK 3: the splits exclude author self-ratings (0036 trust rules)'
-- The self-rating trigger allows rows when auth.uid() is null (legacy
-- imports); a legacy self-rating must not reach the split aggregates.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select null::uuid $$;

insert into public.setup_ratings (user_id, setup_id, pace, predictability, rater_rig)
values ('c0a00005-0000-4000-8000-000000000005', 'c0a00007-0000-4000-8000-000000000007', 5, 5, 'Gamepad');

-- Put the real rater back on a Gamepad rig so the bucket is unambiguous.
update public.setup_ratings
  set rater_rig = 'Gamepad'
  where user_id = 'c0a00006-0000-4000-8000-000000000006'
    and setup_id = 'c0a00007-0000-4000-8000-000000000007';

do $$
declare
  v_row record;
begin
  select * into v_row
  from public.get_setup_rating_splits(array['c0a00007-0000-4000-8000-000000000007']::uuid[]);
  if v_row.pace_n <> 1 or v_row.pace_sum <> 4 or v_row.pred_n <> 1 or v_row.pred_sum <> 2 then
    raise exception 'REGRESSION: splits include self-ratings or wrong sums (pace_n=% pace_sum=% pred_n=% pred_sum=%)',
      v_row.pace_n, v_row.pace_sum, v_row.pred_n, v_row.pred_sum;
  end if;
  raise notice 'CHECK 3 passed: self-ratings excluded from splits';
end $$;

\echo 'CHECK 4: the RPC groups by rig and is callable as anon'
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'c0a00006-0000-4000-8000-000000000006'::uuid $$;

insert into public.setup_ratings (user_id, setup_id, pace, predictability, rater_rig)
values ('c0a00006-0000-4000-8000-000000000006', 'c0a00007-0000-4000-8000-000000000007', 4, 2, 'Gamepad')
on conflict (user_id, setup_id) do update set rater_rig = excluded.rater_rig;

set local role anon;
do $$
declare
  v_count integer;
begin
  select count(*)::integer into v_count
  from public.get_setup_rating_splits(array['c0a00007-0000-4000-8000-000000000007']::uuid[]);
  if v_count <> 1 then
    raise exception 'REGRESSION: expected 1 rig bucket for anon, got %', v_count;
  end if;
  raise notice 'CHECK 4 passed: RPC groups by rig and runs as anon';
end $$;
reset role;
