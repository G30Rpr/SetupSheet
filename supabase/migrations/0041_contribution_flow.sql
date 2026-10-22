-- 0041_contribution_flow.sql
-- Phase 3 contribution flow, parser-independent parts:
--
--   1. setup_download_events -- per-signed-in-user download rows, the source
--      of truth for the 24h post-download rating prompt. (The public
--      setups.downloads counter keeps counting everyone, anonymous
--      included; it is a counter, not a user list.)
--   2. rating_weight() -- THE one documented place that decides how much a
--      rating counts, so "Garage-verified weighting" is auditable in one
--      spot. 2.0 when the rater filed a Garage-derived field-test report
--      for this setup (0032: reports are server-derived from logged laps,
--      never hand-asserted), else 1.0. Private Garage data beyond that
--      deliberately does NOT influence weights -- only the already-public
--      field-test projection, so aggregates leak nothing new.
--   3. recompute_setup_rating_for() -- replaced here (same signature; this
--      is a function body swap, not a schema drop) to average ratings with
--      rating_weight. rating_count stays the literal count of non-self
--      ratings -- displayed "n ratings" never inflates. Self-ratings stay
--      excluded exactly as in 0036_rating_trust.sql.
--   4. setup_impact_counts -- count-only public projection of one thing
--      derived from private Garage laps: how many laps OTHER drivers logged
--      in sessions started from each setup. Same trust model as
--      field_test_counts (0032): counts only, no driver identity, no lap
--      times, no session rows ever leave the Garage schema.
--   5. leaderboard view gains impact columns for the reworked ranking
--      (laps driven by others first, then field-tested setups).
--
-- Additive throughout; the only replaced object is the recompute function
-- body (called out per the migration rules).

begin;

-- ---------------------------------------------------------------------------
-- 1. Download events (signed-in downloads only).
-- ---------------------------------------------------------------------------
create table if not exists public.setup_download_events (
  id uuid primary key default gen_random_uuid(),
  setup_id uuid not null references public.setups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Set when the owner dismisses the rating prompt for this setup; the
  -- prompt is per (user, setup), not per download.
  prompt_dismissed_at timestamptz
);

comment on table public.setup_download_events is
  'Signed-in downloads, for the 24h post-download rating prompt. Anonymous downloads only bump the setups.downloads counter.';
comment on column public.setup_download_events.prompt_dismissed_at is
  'When the owner dismissed the rating prompt for this setup (any row for the pair marks the pair dismissed).';

create index setup_download_events_user_created_idx
  on public.setup_download_events (user_id, created_at desc, id desc);
create index setup_download_events_setup_idx
  on public.setup_download_events (setup_id);
create index setup_download_events_pair_idx
  on public.setup_download_events (user_id, setup_id);

alter table public.setup_download_events enable row level security;

-- Owners see and manage only their own download history. Nothing about who
-- downloaded what is readable by anyone else (the setups.downloads counter
-- remains an anonymous integer).
create policy "Owners read their download events" on public.setup_download_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners record their download events" on public.setup_download_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Owners dismiss their rating prompt" on public.setup_download_events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- Deletion is a support affordance for the owner only (no public deletes).
create policy "Owners delete their download events" on public.setup_download_events
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.setup_download_events
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. The one documented rating-weight function.
-- ---------------------------------------------------------------------------
create or replace function public.rating_weight(p_rater_id uuid, p_setup_id uuid)
returns numeric
language sql
stable
security definer set search_path = public
as $$
  -- Garage-verified weighting (Phase 3 contribution flow). ONE place decides
  -- how much a rating counts:
  --   2.0  rater has a field-test report for this setup -- server-derived
  --        from an owned Garage session with logged laps (0032), i.e. they
  --        demonstrably drove it and the work was checked.
  --   1.0  everyone else.
  -- Deliberately NOT influenced by anything else in Garage (session counts,
  -- lap times, run plans): weighting on private data would leak it through
  -- the aggregate. When this changes, change it here and nowhere else.
  select case
    when exists (
      select 1 from public.field_test_reports f
      where f.user_id = p_rater_id and f.setup_id = p_setup_id
    ) then 2.0
    else 1.0
  end;
$$;

comment on function public.rating_weight(uuid, uuid) is
  'How much a rating counts (Garage-verified weighting). 2.0 when the rater filed a field-test report for the setup, else 1.0. The single documented source of weighting.';

grant execute on function public.rating_weight(uuid, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Weighted aggregates (same signature as 0036; body replaced atomically).
-- ---------------------------------------------------------------------------
create or replace function public.recompute_setup_rating_for(p_setup_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_author uuid;
begin
  select user_id into v_author from public.setups where id = p_setup_id;
  update public.setups
  set
    -- Weighted means via rating_weight(); round() = one decimal like before.
    -- Each score averages only over the raters who left that score (pace and
    -- predictability can be rated separately).
    pace = coalesce((
      select round(sum(r.pace * public.rating_weight(r.user_id, r.setup_id)) /
                   nullif(sum(public.rating_weight(r.user_id, r.setup_id)), 0), 1)
      from public.setup_ratings r
      where r.setup_id = p_setup_id and r.user_id <> v_author and r.pace is not null
    ), 0),
    predictability = coalesce((
      select round(sum(r.predictability * public.rating_weight(r.user_id, r.setup_id)) /
                   nullif(sum(public.rating_weight(r.user_id, r.setup_id)), 0), 1)
      from public.setup_ratings r
      where r.setup_id = p_setup_id and r.user_id <> v_author and r.predictability is not null
    ), 0),
    -- Unweighted literal count: the displayed "n ratings" is how many people
    -- spoke, not how much they counted.
    rating_count = (
      select count(*) from public.setup_ratings r
      where r.setup_id = p_setup_id and r.user_id <> v_author
    )
  where id = p_setup_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4-5. Impact counts + leaderboard impact columns.
-- ---------------------------------------------------------------------------
-- The ONLY projection of private Garage laps that ever leaves the Garage
-- schema: per-setup integer counts of laps other drivers logged in sessions
-- started from that setup. No driver identities, no lap times, no session
-- rows. (Same precedent as field_test_counts in 0032.)
create or replace view public.setup_impact_counts
with (security_barrier = true)
as
select
  s.id as setup_id,
  (
    select count(*)
    from public.garage_laps gl
    join public.garage_sessions gs on gs.id = gl.session_id
    where gs.source_setup_id = s.id
      and gs.user_id <> s.user_id
  )::int as laps_driven_by_others
from public.setups s;

grant select on public.setup_impact_counts to anon, authenticated;

create or replace view public.leaderboard
with (security_invoker = true)
as
select
  p.id as user_id,
  p.username,
  p.avatar_url,
  count(s.id)::int as setup_count,
  coalesce(sum(s.upvotes), 0)::int as total_upvotes,
  coalesce(sum(s.rating_count), 0)::int as total_ratings,
  coalesce(sum(imp.laps_driven_by_others), 0)::int as laps_driven_by_others,
  coalesce(
    sum(case when ft.report_count > 0 then 1 else 0 end), 0
  )::int as field_tested_setup_count
from public.profiles p
left join public.setups s on s.user_id = p.id
left join public.setup_impact_counts imp on imp.setup_id = s.id
left join public.field_test_counts ft on ft.setup_id = s.id
group by p.id, p.username, p.avatar_url;

commit;
