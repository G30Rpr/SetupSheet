-- 0040_saved_rig_profiles.sql
-- Phase 3 item 2b: an account-level "my rig" record, used to power the
-- "Best for my rig" browse sort and the "Matches your rig" chip. This is a
-- deliberate, saved preference -- distinct from `setupsheet:last-rig`
-- (device-local convenience in src/lib/last-rig.ts, never sent to the
-- server) and from `rater_rig` / `setup_ratings` axes (per-rating evidence).
--
-- Privacy: the row describes its owner's hardware, which is exactly the
-- kind of personal rig data the RLS rules exist for. Only the owner can
-- read or write it -- there is no public read policy at all, and the app
-- never surfaces one user's rig profile to another. Columns follow the
-- 0039 axis vocabulary; input_device is required (a saved rig starts by
-- naming how you steer), brake_type is nullable so gamepads -- which have
-- no pedal hardware of interest -- can save null, matching
-- rig_axes_for('Gamepad') = (gamepad, null).
--
-- App wiring: getViewerRig (src/lib/supabase/saved-rig.ts) reads the row
-- server-side for the browse page; saveRigProfile (src/lib/actions/saved-rig.ts)
-- upserts it; anonymous visitors get the same features from
-- readLastRigAxes() (localStorage) or axes derived from readLastRig().

begin;

create table if not exists public.saved_rig_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  input_device text not null,
  brake_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_rig_profiles_input_device_check
    check (input_device in ('gamepad', 'wheel', 'direct_drive')),
  constraint saved_rig_profiles_brake_type_check
    check (brake_type in ('standard', 'load_cell', 'handbrake'))
);

comment on table public.saved_rig_profiles is
  'Owner-saved rig axes for browse personalization (Best for my rig / Matches your rig). Owner-only; never shared with other users.';
comment on column public.saved_rig_profiles.input_device is
  'Rig axis 1 (0039 vocabulary): gamepad | wheel | direct_drive.';
comment on column public.saved_rig_profiles.brake_type is
  'Rig axis 2 (0039 vocabulary): standard | load_cell | handbrake; null for gamepads.';

alter table public.saved_rig_profiles enable row level security;

-- Owner-only, all four verbs. No anon policy and no "other users" read:
-- a rig profile is private by default.
create policy "Owners read their saved rig" on public.saved_rig_profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owners save their saved rig" on public.saved_rig_profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Owners update their saved rig" on public.saved_rig_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owners delete their saved rig" on public.saved_rig_profiles
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Keep the timestamp honest on every write (0007 pattern).
create or replace function public.touch_saved_rig_profile() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger saved_rig_profiles_touch
  before update on public.saved_rig_profiles
  for each row execute function public.touch_saved_rig_profile();

-- Column-level grants for the API roles (default privileges cover new
-- tables, but be explicit like the rest of the series).
grant select, insert, update, delete on public.saved_rig_profiles
  to anon, authenticated, service_role;

commit;
