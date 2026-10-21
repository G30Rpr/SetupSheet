-- zz_saved_rig_profiles.test.sql
-- Regression tests for 0040_saved_rig_profiles.sql (Phase 3 item 2b).
-- Checks: (1) table exists with the axis vocabulary, (2) RLS is on and
-- owner-only, (3) an owner can read and upsert their own row, (4) one user
-- can neither read nor modify another user's rig, (5) anon sees nothing.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Fixtures: two users (uuid_nil and a fixed second id), seeded as superuser
-- so RLS does not interfere with setup.
-- ---------------------------------------------------------------------------
begin;
insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000000'::uuid),
  ('00000000-0000-0000-0000-000000000001');
-- User B's row, inserted directly (owner policies only cover self-service).
insert into public.saved_rig_profiles (user_id, input_device, brake_type)
values ('00000000-0000-0000-0000-000000000001', 'gamepad', null);
commit;

-- ---------------------------------------------------------------------------
-- RLS checks run as `authenticated` with auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid (user A).
-- ---------------------------------------------------------------------------
begin;
create or replace function auth.uid() returns uuid
language sql stable as $$ select '00000000-0000-0000-0000-000000000000'::uuid $$;
set local role authenticated;

do $$
declare
  n int;
  got text;
begin
  -- ------------------------------------------------------------------
  -- 1. RLS enabled, owner-only CRUD policies, axis vocabulary CHECKs.
  -- ------------------------------------------------------------------
  if to_regclass('public.saved_rig_profiles') is null then
    raise exception 'saved_rig_profiles is missing';
  end if;

  select count(*) into n
  from pg_policies
  where schemaname = 'public' and tablename = 'saved_rig_profiles';
  if n < 4 then
    raise exception 'expected owner-only CRUD policies on saved_rig_profiles, found %', n;
  end if;

  begin
    insert into public.saved_rig_profiles (user_id, input_device, brake_type)
    values (auth.uid(), 'wheel', 'load_cell');
  exception when check_violation then
    raise exception 'valid wheel/load_cell row rejected';
  end;

  begin
    insert into public.saved_rig_profiles (user_id, input_device)
    values (auth.uid(), 'flight_stick');
    raise exception 'invalid input_device was accepted';
  exception when check_violation then null;
  end;

  begin
    update public.saved_rig_profiles set brake_type = 'drum_brakes'
    where user_id = auth.uid();
    raise exception 'invalid brake_type was accepted';
  exception when check_violation then null;
  end;

  -- ------------------------------------------------------------------
  -- 2. Owner can read and upsert their own row (brake axis nullable).
  -- ------------------------------------------------------------------
  select input_device into got from public.saved_rig_profiles
  where user_id = auth.uid();
  if got is distinct from 'wheel' then
    raise exception 'owner cannot read their saved rig (got %)', got;
  end if;

  update public.saved_rig_profiles
  set input_device = 'direct_drive', brake_type = 'load_cell'
  where user_id = auth.uid();
  if not found then
    raise exception 'owner cannot update their saved rig';
  end if;

  -- ------------------------------------------------------------------
  -- 3. Cross-user privacy: user B's row is invisible and untouchable.
  -- ------------------------------------------------------------------
  select count(*) into n from public.saved_rig_profiles
  where user_id = '00000000-0000-0000-0000-000000000001';
  if n <> 0 then
    raise exception 'user A can see user B''s saved rig (% rows)', n;
  end if;

  update public.saved_rig_profiles set input_device = 'wheel'
  where user_id = '00000000-0000-0000-0000-000000000001';
  if found then
    raise exception 'user A modified user B''s saved rig';
  end if;

  delete from public.saved_rig_profiles
  where user_id = '00000000-0000-0000-0000-000000000001';
  if found then
    raise exception 'user A deleted user B''s saved rig';
  end if;

  begin
    insert into public.saved_rig_profiles (user_id, input_device)
    values ('00000000-0000-0000-0000-000000000001', 'direct_drive');
    raise exception 'cross-user insert was accepted';
  exception when insufficient_privilege or check_violation then null;
  end;
end;
$$;

-- ------------------------------------------------------------------
-- 4. Anon sees nothing at all (no public read of anyone's rig).
-- ------------------------------------------------------------------
set local role anon;
do $$
declare
  n int;
begin
  select count(*) into n from public.saved_rig_profiles;
  if n <> 0 then
    raise exception 'anon can read saved rig profiles (% rows)', n;
  end if;
end;
$$;

rollback;
