-- Rating trust layer (Phase 1). Three rules, all enforced in the database:
--
--   1. Authors can never rate their own setups. The tightened RLS policies
--      cover the PostgREST path; the trigger enforces the same rule as a
--      row-level invariant on every other path (SECURITY DEFINER functions,
--      SQL editor, service role, future code): a rating row's user_id can
--      never equal the setup's author. No auth-context escape hatch -- the
--      test harness simulates pre-0036 rows by disabling the trigger, the
--      same way those rows actually got there (they predate it).
--   2. Existing self-ratings are excluded from displayed aggregates WITHOUT
--      being deleted. History stays queryable by moderators; it simply stops
--      counting toward the community score. A setup whose only ratings are
--      its author's shows as Unrated (pace/predictability 0, rating_count 0).
--   3. create_setup_with_rating() no longer seeds an uploader self-rating:
--      a published setup starts Unrated ("until someone has run it"). The
--      p_pace / p_predictability parameters are kept (with defaults) so
--      in-flight clients mid-deploy don't break, but they are ignored --
--      dropping or rewriting parameters here would violate the additive-
--      migrations rule and risk a deploy-order outage.

-- ============================================================================
-- 1a. Block self-rating at the row level (covers non-RLS paths)
-- ============================================================================

create or replace function public.prevent_self_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_author uuid;
begin
  select user_id into v_author from public.setups where id = new.setup_id;
  -- Row-level invariant: the rating's own user_id is the self, regardless of
  -- who or what is executing (JWT, service role, SQL editor). Pre-0036 rows
  -- already in the table are unaffected -- this only guards writes.
  if v_author is not null and v_author = new.user_id then
    raise exception 'You cannot rate your own setup.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists setup_ratings_prevent_self on public.setup_ratings;
create trigger setup_ratings_prevent_self
  before insert or update on public.setup_ratings
  for each row execute function public.prevent_self_rating();

-- ============================================================================
-- 1b. Tighten the RLS policies (same rule, enforced at the API boundary too)
-- ============================================================================

drop policy "Users can rate as themselves" on public.setup_ratings;
create policy "Users can rate as themselves"
  on public.setup_ratings for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.setups s
      where s.id = setup_id and s.user_id = auth.uid()
    )
  );

-- The update policy needs the same guard: without it a rater could point an
-- existing rating row at one of their own setups (setup_id is part of the
-- primary key but not immutable).
drop policy "Users can update their own rating" on public.setup_ratings;
create policy "Users can update their own rating"
  on public.setup_ratings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.setups s
      where s.id = setup_id and s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 2. Aggregates exclude self-ratings (rows are kept)
-- ============================================================================

-- Recompute one setup's displayed aggregate from non-self ratings. Extracted
-- so the trigger, the update-recompute below, and the backfill all share one
-- definition of "what counts".
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
    pace = coalesce((
      select round(avg(r.pace), 1) from public.setup_ratings r
      where r.setup_id = p_setup_id and r.user_id <> v_author
    ), 0),
    predictability = coalesce((
      select round(avg(r.predictability), 1) from public.setup_ratings r
      where r.setup_id = p_setup_id and r.user_id <> v_author
    ), 0),
    rating_count = (
      select count(*) from public.setup_ratings r
      where r.setup_id = p_setup_id and r.user_id <> v_author
    )
  where id = p_setup_id;
end;
$$;

create or replace function public.recompute_setup_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.recompute_setup_rating_for(coalesce(new.setup_id, old.setup_id));
  -- A rating moved between setups must refresh both aggregates.
  if tg_op = 'UPDATE' and old.setup_id is distinct from new.setup_id then
    perform public.recompute_setup_rating_for(old.setup_id);
  end if;
  return null;
end;
$$;

-- One-shot recompute over existing data (reversible in the sense that the
-- rows are untouched: removing the r.user_id filter and re-running restores
-- the old numbers). This is what turns historical self-ratings off in the
-- displayed scores without deleting anything.
select public.recompute_setup_rating_for(id) from public.setups;

-- ============================================================================
-- 3. Publishing starts Unrated -- no uploader self-rating
-- ============================================================================

create or replace function public.create_setup_with_rating(
  p_game text,
  p_car text,
  p_track text,
  p_condition text,
  p_lap_time text,
  p_description text,
  p_tags text[],
  p_rig_profile text,
  p_setup_values jsonb,
  p_file_path text,
  p_file_name text,
  p_video_url text,
  p_telemetry_file_path text,
  p_telemetry_file_name text,
  -- DEPRECATED: accepted for signature compatibility with clients deployed
  -- before this migration; ignored. Ratings only come from other users.
  p_pace smallint default null,
  p_predictability smallint default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_setup_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.setups (
    user_id, game, car, track, condition, lap_time, description, tags,
    rig_profile, setup_values, file_path, file_name, video_url,
    telemetry_file_path, telemetry_file_name
  ) values (
    v_user_id, p_game, p_car, p_track, p_condition, p_lap_time, p_description,
    p_tags, p_rig_profile, p_setup_values, p_file_path, p_file_name, p_video_url,
    p_telemetry_file_path, p_telemetry_file_name
  )
  returning id into v_setup_id;

  -- No self-rating row: the setup is Unrated until someone else runs it.
  return v_setup_id;
end;
$$;
