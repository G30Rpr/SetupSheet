-- 0038: patch compatibility (Phase 3).
--
-- Two small data sources power the "built for an older patch" badge:
--
--   1. setups.game_version -- the patch the author built the setup on,
--      author-reported and optional (user decision 2026-10-19: "uploader
--      enters it"). Null means "not reported"; the UI makes no claims about
--      such setups.
--   2. games_versions -- one row per game with the CURRENT patch, maintained
--      by the operator (SQL editor / service role). Only when this row
--      exists AND differs from a setup's reported version does the app call
--      a setup stale. No row means no claim (never invent version data).
--
-- Trust model: contributors write setups.game_version on their own rows via
-- RLS as usual. games_versions has NO insert/update policies for
-- anon/authenticated -- a contributor can never fake the community's
-- current patch. Reads are public reference data.
--
-- Additive only: nullable columns, new table, defaulted RPC parameter. The
-- setup_search view is recreated with strictly more columns (a projection,
-- no data). The RPC is dropped-and-recreated in ONE script because Postgres
-- treats a different argument list as an overload (see below).

alter table public.setups add column game_version text null;

alter table public.setups
  add constraint setup_game_version_length
  check (game_version is null or char_length(game_version) between 1 and 40);

comment on column public.setups.game_version is
  'Game patch the setup was built on, author-reported; null = not reported. Compared against games_versions for staleness badges.';

-- The edit-snapshot table follows, same as 0017 did for video/telemetry.
alter table public.setup_versions add column game_version text null;

-- Column-scoped grants must name the new column or authenticated writes
-- stop at "permission denied" (0021 pattern for insert, 0009/0017 for
-- update). Re-grant the full lists including game_version.
revoke insert on public.setups from authenticated;
grant insert (
  user_id, game, car, track, condition, lap_time, game_version, description,
  tags, rig_profile, setup_values, file_path, file_name, video_url,
  telemetry_file_path, telemetry_file_name
) on public.setups to authenticated;

revoke update on public.setups from authenticated;
grant update (
  game, car, track, condition, lap_time, game_version, description,
  tags, rig_profile, setup_values, file_path, file_name,
  video_url, telemetry_file_path, telemetry_file_name
) on public.setups to authenticated;

-- Operator-maintained "current patch per game". Empty table = "unknown,
-- claim nothing".
create table public.games_versions (
  game text primary key
    check (char_length(game) between 1 and 80),
  current_version text not null
    check (char_length(current_version) between 1 and 40),
  updated_at timestamptz not null default now()
);

comment on table public.games_versions is
  'Operator-maintained current patch per game (SQL editor / service role only). Staleness badges only fire when a row exists here; empty means "unknown, claim nothing".';

alter table public.games_versions enable row level security;

create policy "Current patch is public reference data"
  on public.games_versions for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies on purpose: writes happen only through
-- the operator (SQL editor / service role). Tested in zz_game_versions.test.sql.

-- Recreate the browse search view with the new column. The view is a
-- projection (no data): recreating it with strictly more columns is
-- additive. Same security_invoker semantics as 0024.
drop view if exists public.setup_search;

create view public.setup_search
with (security_invoker = true)
as
select
  s.id,
  s.user_id,
  s.game,
  s.car,
  s.track,
  s.condition,
  s.lap_time,
  s.game_version,
  s.description,
  s.tags,
  s.rig_profile,
  s.setup_values,
  s.file_path,
  s.file_name,
  s.video_url,
  s.telemetry_file_path,
  s.telemetry_file_name,
  s.pace,
  s.predictability,
  s.rating_count,
  s.upvotes,
  s.downloads,
  s.created_at,
  s.updated_at,
  p.username as author_username
from public.setups as s
left join public.profiles as p on p.id = s.user_id;

grant select on public.setup_search to anon, authenticated;

-- Recreate create_setup_with_rating with one appended, defaulted parameter.
-- Postgres treats a different argument list as an OVERLOAD, so the old
-- 16-parameter signature must be dropped in the same script -- otherwise
-- existing 16-arg callers match both versions ("function is not unique").
-- Run this file as one script (the Supabase runner and SQL editor both do):
-- old and new never coexist within it.
drop function if exists public.create_setup_with_rating(
  text, text, text, text, text, text, text[], text, jsonb,
  text, text, text, text, text, smallint, smallint
);

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
  -- before 0036; ignored. Ratings only come from other users.
  p_pace smallint default null,
  p_predictability smallint default null,
  p_game_version text default null
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
    telemetry_file_path, telemetry_file_name, game_version
  ) values (
    v_user_id, p_game, p_car, p_track, p_condition, p_lap_time, p_description,
    p_tags, p_rig_profile, p_setup_values, p_file_path, p_file_name, p_video_url,
    p_telemetry_file_path, p_telemetry_file_name,
    nullif(p_game_version, '')
  )
  returning id into v_setup_id;

  -- No self-rating row: the setup is Unrated until someone else runs it.
  return v_setup_id;
end;
$$;

-- Replace the edit-snapshot trigger function so a game_version change also
-- snapshots (0017 pattern).
create or replace function public.handle_setup_update_snapshot()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (
    old.game is distinct from new.game or
    old.car is distinct from new.car or
    old.track is distinct from new.track or
    old.condition is distinct from new.condition or
    old.lap_time is distinct from new.lap_time or
    old.game_version is distinct from new.game_version or
    old.description is distinct from new.description or
    old.tags is distinct from new.tags or
    old.rig_profile is distinct from new.rig_profile or
    old.setup_values is distinct from new.setup_values or
    old.file_path is distinct from new.file_path or
    old.file_name is distinct from new.file_name or
    old.video_url is distinct from new.video_url or
    old.telemetry_file_path is distinct from new.telemetry_file_path or
    old.telemetry_file_name is distinct from new.telemetry_file_name
  ) then
    insert into public.setup_versions (
      setup_id, edited_by, game, car, track, condition, lap_time,
      description, tags, rig_profile, setup_values, file_path, file_name,
      video_url, telemetry_file_path, telemetry_file_name, game_version
    ) values (
      old.id, new.user_id, old.game, old.car, old.track, old.condition, old.lap_time,
      old.description, old.tags, old.rig_profile, old.setup_values, old.file_path, old.file_name,
      old.video_url, old.telemetry_file_path, old.telemetry_file_name, old.game_version
    );
  end if;
  return new;
end;
$$;
