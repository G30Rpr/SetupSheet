-- Turns Pace and Predictability from a one-time self-rating (set by the
-- uploader at submission and never touched again) into a real community
-- average. setup_ratings holds one row per (user, setup); setups.pace and
-- setups.predictability become the average across all ratings, kept in
-- sync by a trigger the same way setups.upvotes already is.

-- ============================================================================
-- setups: pace/predictability become averages, not fixed 1-5 integers
-- ============================================================================

alter table public.setups drop constraint setups_pace_check;
alter table public.setups drop constraint setups_predictability_check;

alter table public.setups alter column pace type numeric(2,1) using pace::numeric(2,1);
alter table public.setups alter column pace set default 0;
alter table public.setups alter column predictability type numeric(2,1) using predictability::numeric(2,1);
alter table public.setups alter column predictability set default 0;

-- 0 is a valid transient state: a brand new setup has a default of 0 for the
-- instant between inserting the setup row and inserting the creator's own
-- rating row (see createSetup in src/lib/actions/setups.ts).
alter table public.setups add constraint setups_pace_check check (pace >= 0 and pace <= 5);
alter table public.setups add constraint setups_predictability_check check (predictability >= 0 and predictability <= 5);

alter table public.setups add column rating_count integer not null default 0;

-- ============================================================================
-- setup_ratings
-- ============================================================================

create table public.setup_ratings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  setup_id uuid not null references public.setups (id) on delete cascade,
  pace smallint not null check (pace between 1 and 5),
  predictability smallint not null check (predictability between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, setup_id)
);

alter table public.setup_ratings enable row level security;

create policy "Users can view their own ratings"
  on public.setup_ratings for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can rate as themselves"
  on public.setup_ratings for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own rating"
  on public.setup_ratings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can remove their own rating"
  on public.setup_ratings for delete
  to authenticated
  using (auth.uid() = user_id);

-- Recomputes setups.pace / predictability / rating_count from scratch off
-- setup_ratings whenever a rating is added, changed, or removed. A live
-- recompute (rather than incremental sum/count tracking) avoids drift bugs
-- and is cheap since rating volume per setup is small.
create function public.recompute_setup_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_setup_id uuid := coalesce(new.setup_id, old.setup_id);
begin
  update public.setups
  set
    pace = coalesce((select round(avg(pace), 1) from public.setup_ratings where setup_id = target_setup_id), 0),
    predictability = coalesce((select round(avg(predictability), 1) from public.setup_ratings where setup_id = target_setup_id), 0),
    rating_count = (select count(*) from public.setup_ratings where setup_id = target_setup_id)
  where id = target_setup_id;
  return null;
end;
$$;

create trigger on_setup_rating_changed
  after insert or update or delete on public.setup_ratings
  for each row execute function public.recompute_setup_rating();

-- ============================================================================
-- Backfill: every existing setup's original pace/predictability was really
-- just its uploader's own self-rating, so turn that into their first
-- (only, for now) row in setup_ratings. Firing the trigger above then
-- re-derives setups.pace/predictability/rating_count from it -- same
-- values as before, now flowing through the real aggregate path.
-- ============================================================================

insert into public.setup_ratings (user_id, setup_id, pace, predictability)
select user_id, id, pace::smallint, predictability::smallint
from public.setups
on conflict (user_id, setup_id) do nothing;
