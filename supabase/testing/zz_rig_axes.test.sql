-- Regression coverage for 0039_rig_axes.sql (two-axis rig profile):
--   CHECK 1: rig_axes_for() encodes the documented 4-category mapping
--   CHECK 2: setup axes are derived on insert and follow rig_profile edits
--   CHECK 3: rating axes are derived from rater_rig (null rig -> null axes)
--   CHECK 4: the axis constraints reject unknown values
--   CHECK 5: the backfill fills only missing axes and is idempotent
--   CHECK 6: the browse search view exposes the axes

-- Actors (fresh c0a0000{b,c} ids so we don't collide with other zz suites).
insert into auth.users (id, email, raw_user_meta_data) values
  ('c0a0000b-0000-4000-8000-00000000000b', 'rig-axes-author@test.local', '{}'),
  ('c0a0000c-0000-4000-8000-00000000000c', 'rig-axes-rater@test.local', '{}')
on conflict (id) do nothing;

create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'c0a0000b-0000-4000-8000-00000000000b'::uuid $$;

insert into public.profiles (id, username) values
  ('c0a0000b-0000-4000-8000-00000000000b', 'rigaxesauthor'),
  ('c0a0000c-0000-4000-8000-00000000000c', 'rigaxesrater')
on conflict (id) do nothing;

\echo 'CHECK 1: rig_axes_for() encodes the documented mapping'
do $$
declare
  v record;
begin
  select * into v from public.rig_axes_for('Gamepad');
  if v.input_device is distinct from 'gamepad' or v.brake_type is not null then
    raise exception 'REGRESSION: Gamepad mapping wrong (%, %)', v.input_device, v.brake_type;
  end if;
  select * into v from public.rig_axes_for('Wheel + 3 Pedals');
  if v.input_device is distinct from 'wheel' or v.brake_type is distinct from 'standard' then
    raise exception 'REGRESSION: Wheel + 3 Pedals mapping wrong (%, %)', v.input_device, v.brake_type;
  end if;
  select * into v from public.rig_axes_for('Wheel + Handbrake');
  if v.input_device is distinct from 'wheel' or v.brake_type is distinct from 'handbrake' then
    raise exception 'REGRESSION: Wheel + Handbrake mapping wrong (%, %)', v.input_device, v.brake_type;
  end if;
  select * into v from public.rig_axes_for('Direct Drive + Load Cell');
  if v.input_device is distinct from 'direct_drive' or v.brake_type is distinct from 'load_cell' then
    raise exception 'REGRESSION: Direct Drive + Load Cell mapping wrong (%, %)', v.input_device, v.brake_type;
  end if;
  select * into v from public.rig_axes_for('Unicycle');
  if v.input_device is not null or v.brake_type is not null then
    raise exception 'REGRESSION: unknown rig produced axes (%, %)', v.input_device, v.brake_type;
  end if;
  raise notice 'CHECK 1 passed: all four categories map as documented';
end $$;

\echo 'CHECK 2: setup axes are derived on insert and follow rig_profile edits'
do $$
declare
  v_input text;
  v_brake text;
begin
  insert into public.setups
    (id, user_id, game, car, track, condition, description, tags, rig_profile)
  values
    ('c0a0000d-0000-4000-8000-00000000000d', 'c0a0000b-0000-4000-8000-00000000000b',
     'Assetto Corsa Competizione', 'BMW M4 GT3 2021', 'Monza', 'Dry',
     'rig axes setup', '{}'::text[], 'Wheel + Handbrake');

  select input_device, brake_type into v_input, v_brake
  from public.setups where id = 'c0a0000d-0000-4000-8000-00000000000d';
  if v_input is distinct from 'wheel' or v_brake is distinct from 'handbrake' then
    raise exception 'REGRESSION: insert did not derive axes (%, %)', v_input, v_brake;
  end if;

  update public.setups
    set rig_profile = 'Direct Drive + Load Cell'
    where id = 'c0a0000d-0000-4000-8000-00000000000d';

  select input_device, brake_type into v_input, v_brake
  from public.setups where id = 'c0a0000d-0000-4000-8000-00000000000d';
  if v_input is distinct from 'direct_drive' or v_brake is distinct from 'load_cell' then
    raise exception 'REGRESSION: rig_profile edit did not re-derive axes (%, %)', v_input, v_brake;
  end if;
  raise notice 'CHECK 2 passed: setup axes derive on insert and on rig_profile edit';
end $$;

\echo 'CHECK 3: rating axes derive from rater_rig (null rig -> null axes)'
do $$
declare
  v_input text;
  v_brake text;
begin
  insert into public.setup_ratings (user_id, setup_id, pace, predictability, rater_rig)
  values ('c0a0000c-0000-4000-8000-00000000000c', 'c0a0000d-0000-4000-8000-00000000000d',
          4, 3, 'Gamepad');

  select rater_input_device, rater_brake_type into v_input, v_brake
  from public.setup_ratings
  where user_id = 'c0a0000c-0000-4000-8000-00000000000c'
    and setup_id = 'c0a0000d-0000-4000-8000-00000000000d';
  if v_input is distinct from 'gamepad' or v_brake is not null then
    raise exception 'REGRESSION: rating axes wrong (%, %)', v_input, v_brake;
  end if;

  update public.setup_ratings
    set rater_rig = null
    where user_id = 'c0a0000c-0000-4000-8000-00000000000c'
      and setup_id = 'c0a0000d-0000-4000-8000-00000000000d';

  select rater_input_device, rater_brake_type into v_input, v_brake
  from public.setup_ratings
  where user_id = 'c0a0000c-0000-4000-8000-00000000000c'
    and setup_id = 'c0a0000d-0000-4000-8000-00000000000d';
  if v_input is not null or v_brake is not null then
    raise exception 'REGRESSION: null rater_rig kept axes (%, %)', v_input, v_brake;
  end if;
  raise notice 'CHECK 3 passed: rating axes derive from rater_rig and null out with it';
end $$;

\echo 'CHECK 4: the axis constraints reject unknown values'
do $$
begin
  begin
    update public.setups set input_device = 'joystick'
    where id = 'c0a0000d-0000-4000-8000-00000000000d';
    raise exception 'REGRESSION: unknown input_device accepted';
  exception when check_violation then
    null;
  end;
  begin
    update public.setups set brake_type = 'drum'
    where id = 'c0a0000d-0000-4000-8000-00000000000d';
    raise exception 'REGRESSION: unknown brake_type accepted';
  exception when check_violation then
    raise notice 'CHECK 4 passed: axis constraints hold';
  end;
end $$;

\echo 'CHECK 5: the backfill fills only missing axes and is idempotent'
do $$
declare
  v_input text;
begin
  -- Simulate a pre-0039 row: axes missing, rig_profile present.
  update public.setups set input_device = null, brake_type = null
  where id = 'c0a0000d-0000-4000-8000-00000000000d';

  -- The migration's backfill statement (kept in lockstep on purpose).
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

  select input_device into v_input
  from public.setups where id = 'c0a0000d-0000-4000-8000-00000000000d';
  if v_input is distinct from 'direct_drive' then
    raise exception 'REGRESSION: backfill did not restore axes (got %)', v_input;
  end if;

  -- Idempotent: a second run must not disturb already-derived values.
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

  select input_device into v_input
  from public.setups where id = 'c0a0000d-0000-4000-8000-00000000000d';
  if v_input is distinct from 'direct_drive' then
    raise exception 'REGRESSION: backfill is not idempotent (got %)', v_input;
  end if;
  raise notice 'CHECK 5 passed: backfill restores missing axes and re-runs cleanly';
end $$;

\echo 'CHECK 6: the browse search view exposes the axes'
do $$
declare
  v_input text;
begin
  select input_device into v_input
  from public.setup_search
  where id = 'c0a0000d-0000-4000-8000-00000000000d';
  if v_input is distinct from 'direct_drive' then
    raise exception 'REGRESSION: setup_search lost input_device (got %)', v_input;
  end if;
  raise notice 'CHECK 6 passed: setup_search carries the rig axes';
end $$;

\echo 'Rig axis checks passed.'
