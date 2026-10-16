-- Regression coverage for 0036_rating_trust.sql. The trust rules must hold
-- in the database itself, not just the UI:
--   CHECK 1: an author cannot insert a rating on their own setup
--   CHECK 2: a rater cannot move a rating row onto a setup they authored
--   CHECK 3: another user's rating drives the aggregate
--   CHECK 4: legacy self-ratings are excluded from aggregates but kept
--   CHECK 5: the RLS policies block self-rating on their own (no trigger)

-- Actors: the author of setup cccc..., and another racer who also authors
-- setup dddd.... (auth.users rows first: profiles.id references them)
insert into auth.users (id, email, raw_user_meta_data) values
  ('c0a00001-0000-4000-8000-000000000001', 'author@test.local', '{}'),
  ('c0a00002-0000-4000-8000-000000000002', 'rater@test.local', '{}')
on conflict (id) do nothing;

create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'c0a00001-0000-4000-8000-000000000001'::uuid $$;

insert into public.profiles (id, username) values
  ('c0a00001-0000-4000-8000-000000000001', 'author'),
  ('c0a00002-0000-4000-8000-000000000002', 'rater')
on conflict (id) do nothing;

insert into public.setups
  (id, user_id, game, car, track, condition, description, tags, rig_profile)
values
  ('c0a00003-0000-4000-8000-000000000003', 'c0a00001-0000-4000-8000-000000000001',
   'Assetto Corsa Competizione', 'BMW M4 GT3 2021', 'Spa-Francorchamps', 'Dry',
   'author setup', '{}'::text[], 'Wheel + 3 Pedals'),
  ('c0a00004-0000-4000-8000-000000000004', 'c0a00002-0000-4000-8000-000000000002',
   'Assetto Corsa Competizione', 'BMW M4 GT3 2021', 'Spa-Francorchamps', 'Dry',
   'rater setup', '{}'::text[], 'Wheel + 3 Pedals');

\echo 'CHECK 1: author cannot rate their own setup'
do $$
begin
  insert into public.setup_ratings (user_id, setup_id, pace, predictability)
  values ('c0a00001-0000-4000-8000-000000000001', 'c0a00003-0000-4000-8000-000000000003', 5, 5);
  raise exception 'REGRESSION: self-rating insert was allowed';
exception when others then
  if sqlerrm not like 'You cannot rate your own setup%' then
    raise;
  end if;
  raise notice 'CHECK 1 passed: self-rating insert blocked';
end $$;

\echo 'CHECK 2: a rater cannot redirect a rating onto their own setup'
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'c0a00002-0000-4000-8000-000000000002'::uuid $$;

-- rater -> author's setup (allowed; drives CHECK 3's aggregate)
insert into public.setup_ratings (user_id, setup_id, pace, predictability)
values ('c0a00002-0000-4000-8000-000000000002', 'c0a00003-0000-4000-8000-000000000003', 4, 5);

-- now try to point that row at the rater's OWN setup. Separate block on
-- purpose: a caught exception rolls back the whole plpgsql subtransaction,
-- which would otherwise take the insert above down with it.
do $$
begin
  update public.setup_ratings
  set setup_id = 'c0a00004-0000-4000-8000-000000000004'
  where user_id = 'c0a00002-0000-4000-8000-000000000002'
    and setup_id = 'c0a00003-0000-4000-8000-000000000003';
  raise exception 'REGRESSION: rating was redirected onto a self-owned setup';
exception when others then
  if sqlerrm not like 'You cannot rate your own setup%' then
    raise;
  end if;
  raise notice 'CHECK 2 passed: redirect to own setup blocked';
end $$;

\echo 'CHECK 3: a community rating drives the aggregate'
do $$
declare
  v_pace numeric;
  v_pred numeric;
  v_count integer;
begin
  select pace, predictability, rating_count into v_pace, v_pred, v_count
    from public.setups where id = 'c0a00003-0000-4000-8000-000000000003';
  if v_pace <> 4.0 or v_pred <> 5.0 or v_count <> 1 then
    raise exception 'REGRESSION: aggregate wrong after community rating (%, %, %)', v_pace, v_pred, v_count;
  end if;
  raise notice 'CHECK 3 passed: pace=%, predictability=%, count=%', v_pace, v_pred, v_count;
end $$;

\echo 'CHECK 4: legacy self-ratings are excluded but not deleted'
create or replace function auth.uid() returns uuid language sql stable as
  $$ select null::uuid $$;

-- Simulate a pre-0036 self-rating: those rows predate the trigger, so plant
-- one the same way (trigger off), then prove it stays excluded from the
-- aggregate while remaining queryable.
alter table public.setup_ratings disable trigger setup_ratings_prevent_self;
insert into public.setup_ratings (user_id, setup_id, pace, predictability)
values ('c0a00001-0000-4000-8000-000000000001', 'c0a00003-0000-4000-8000-000000000003', 5, 5);
alter table public.setup_ratings enable trigger setup_ratings_prevent_self;

do $$
declare
  v_pace numeric;
  v_count integer;
begin
  select pace, rating_count into v_pace, v_count
    from public.setups where id = 'c0a00003-0000-4000-8000-000000000003';
  if v_pace <> 4.0 or v_count <> 1 then
    raise exception 'REGRESSION: self-rating leaked into the aggregate (%, %)', v_pace, v_count;
  end if;
  if not exists (
    select 1 from public.setup_ratings
    where user_id = 'c0a00001-0000-4000-8000-000000000001'
      and setup_id = 'c0a00003-0000-4000-8000-000000000003'
  ) then
    raise exception 'REGRESSION: legacy self-rating row was deleted instead of excluded';
  end if;
  raise notice 'CHECK 4 passed: self-rating kept but excluded (pace=%, count=%)', v_pace, v_count;
end $$;

\echo 'CHECK 5: the RLS policies block self-rating on their own'
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'c0a00001-0000-4000-8000-000000000001'::uuid $$;

begin;
-- Prove the policy layer independently: turn the trigger off first.
alter table public.setup_ratings disable trigger setup_ratings_prevent_self;
set local role authenticated;
do $$
begin
  insert into public.setup_ratings (user_id, setup_id, pace, predictability)
  values ('c0a00001-0000-4000-8000-000000000001', 'c0a00003-0000-4000-8000-000000000003', 1, 1);
  raise exception 'REGRESSION: RLS insert policy allowed a self-rating';
exception when others then
  if sqlerrm not like '%row-level security%' and sqlerrm not like '%permission denied%' then
    raise;
  end if;
  raise notice 'CHECK 5 passed: RLS insert policy blocked self-rating';
end $$;
reset role;
alter table public.setup_ratings enable trigger setup_ratings_prevent_self;
commit;

\echo 'Rating trust checks passed.'
