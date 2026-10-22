-- 0039: rig profile as two axes -- input device x brake type (Phase 3,
-- item 2). User decision 2026-10-19 chose the brake axis vocabulary
-- {standard, load_cell, handbrake} so the four legacy categories map
-- injectively with just two columns:
--
--   'Gamepad'                 -> (gamepad,       null)
--   'Wheel + 3 Pedals'        -> (wheel,         standard)
--   'Wheel + Handbrake'       -> (wheel,         handbrake)
--   'Direct Drive + Load Cell'-> (direct_drive,  load_cell)
--
-- rig_profile (the 4-category string) stays the canonical user-facing
-- choice -- the upload picker, filters and copy keep working unchanged.
-- The axes are DERIVED from it by one immutable mapping function, shared
-- by the write-time trigger and the one-shot backfill below, so the two
-- can never disagree. Users' saved rig profiles and axis-based matching
-- (Best for my rig / Matches your rig / per-rig sub-scores) are built on
-- these columns.
--
-- Privacy: setup_ratings axis columns are exactly as private as rater_rig
-- (own-rows RLS, aggregate RPC only). Nothing new is exposed per-row.
--
-- Additive only: nullable columns + constraints + one function + trigger.
-- The backfill is reversible in the same sense as 0036's: the rows are
-- untouched and the columns can be re-derived (or nulled) at any time.

create or replace function public.rig_axes_for(p_rig_profile text)
returns table (input_device text, brake_type text)
language sql
immutable
set search_path = public
as $$
  select case p_rig_profile
      when 'Gamepad' then 'gamepad'
      when 'Wheel + 3 Pedals' then 'wheel'
      when 'Wheel + Handbrake' then 'wheel'
      when 'Direct Drive + Load Cell' then 'direct_drive'
    end,
    case p_rig_profile
      when 'Gamepad' then null
      when 'Wheel + 3 Pedals' then 'standard'
      when 'Wheel + Handbrake' then 'handbrake'
      when 'Direct Drive + Load Cell' then 'load_cell'
    end;
$$;

comment on function public.rig_axes_for(text) is
  'Single source of truth mapping the 4 rig_profile categories to (input_device, brake_type) axes. Unknown input yields (null, null).';

-- ---------------------------------------------------------------- setups --

alter table public.setups add column input_device text null;
alter table public.setups add column brake_type text null;

alter table public.setups
  add constraint setups_input_device_check
  check (input_device is null or input_device in ('gamepad', 'wheel', 'direct_drive'));

alter table public.setups
  add constraint setups_brake_type_check
  check (brake_type is null or brake_type in ('standard', 'load_cell', 'handbrake'));

comment on column public.setups.input_device is
  'Rig axis 1, derived from rig_profile via rig_axes_for(); gamepad/wheel/direct_drive.';
comment on column public.setups.brake_type is
  'Rig axis 2, derived from rig_profile via rig_axes_for(); standard/load_cell/handbrake, null for gamepads.';

-- ---------------------------------------------------------- setup_ratings --

alter table public.setup_ratings add column rater_input_device text null;
alter table public.setup_ratings add column rater_brake_type text null;

alter table public.setup_ratings
  add constraint setup_ratings_rater_input_device_check
  check (rater_input_device is null or rater_input_device in ('gamepad', 'wheel', 'direct_drive'));

alter table public.setup_ratings
  add constraint setup_ratings_rater_brake_type_check
  check (rater_brake_type is null or rater_brake_type in ('standard', 'load_cell', 'handbrake'));

comment on column public.setup_ratings.rater_input_device is
  'Rig axis 1 of the rater, derived from rater_rig via rig_axes_for(); private like rater_rig -- aggregated only.';
comment on column public.setup_ratings.rater_brake_type is
  'Rig axis 2 of the rater, derived from rater_rig via rig_axes_for(); private like rater_rig -- aggregated only.';

-- ------------------------------------------------------- derive on write --

create or replace function public.derive_rig_axes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_axes record;
begin
  if tg_table_name = 'setups' then
    select * into v_axes from public.rig_axes_for(new.rig_profile);
    new.input_device := v_axes.input_device;
    new.brake_type := v_axes.brake_type;
  else
    select * into v_axes from public.rig_axes_for(new.rater_rig);
    new.rater_input_device := v_axes.input_device;
    new.rater_brake_type := v_axes.brake_type;
  end if;
  return new;
end;
$$;

drop trigger if exists setups_derive_rig_axes on public.setups;
create trigger setups_derive_rig_axes
  before insert or update of rig_profile on public.setups
  for each row execute function public.derive_rig_axes();

drop trigger if exists setup_ratings_derive_rig_axes on public.setup_ratings;
create trigger setup_ratings_derive_rig_axes
  before insert or update of rater_rig on public.setup_ratings
  for each row execute function public.derive_rig_axes();

-- The browse search view is queried with the same explicit column list as
-- setups (SETUP_COLUMNS), so it must carry the axes too. Recreated with
-- strictly more columns (a projection, no data).
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
  s.input_device,
  s.brake_type,
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

-- ------------------------------------------------------ one-shot backfill --
-- Same mapping function as the trigger (one source of truth). Idempotent:
-- only rows whose axes are still null are filled, so re-running is safe.

update public.setups s
set
  input_device = m.input_device,
  brake_type = m.brake_type
from (
  select t.id, a.input_device, a.brake_type
  from public.setups as t, lateral public.rig_axes_for(t.rig_profile) as a
  where t.input_device is null
    and a.input_device is not null
) as m
where s.id = m.id;

update public.setup_ratings r
set
  rater_input_device = m.rater_input_device,
  rater_brake_type = m.rater_brake_type
from (
  select t.user_id, t.setup_id, a.input_device as rater_input_device, a.brake_type as rater_brake_type
  from public.setup_ratings as t, lateral public.rig_axes_for(t.rater_rig) as a
  where t.rater_input_device is null
    and a.input_device is not null
) as m
where r.user_id = m.user_id and r.setup_id = m.setup_id;
