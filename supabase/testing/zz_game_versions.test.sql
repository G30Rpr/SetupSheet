-- Regression coverage for 0038_game_versions.sql (patch compatibility):
--   CHECK 1: setups.game_version stores free text and enforces its length cap
--   CHECK 2: create_setup_with_rating records p_game_version (empty -> null)
--   CHECK 3: games_versions is public reference data but operator-write only
--   CHECK 4: authenticated edits change game_version and snapshot the old one
--   CHECK 5: the browse search view exposes game_version

-- Actor (fresh c0a00009 id so we don't collide with other zz suites).
insert into auth.users (id, email, raw_user_meta_data) values
  ('c0a00009-0000-4000-8000-000000000009', 'patch-author@test.local', '{}')
on conflict (id) do nothing;

create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'c0a00009-0000-4000-8000-000000000009'::uuid $$;

insert into public.profiles (id, username) values
  ('c0a00009-0000-4000-8000-000000000009', 'patchauthor')
on conflict (id) do nothing;

\echo 'CHECK 1: game_version stores text and enforces the 40-char cap'
do $$
begin
  insert into public.setups
    (id, user_id, game, car, track, condition, description, tags, rig_profile, game_version)
  values
    ('c0a0000a-0000-4000-8000-00000000000a', 'c0a00009-0000-4000-8000-000000000009',
     'Assetto Corsa Competizione', 'BMW M4 GT3 2021', 'Monza', 'Dry',
     'patch compat setup', '{}'::text[], 'Wheel + 3 Pedals', '1.6.2');

  begin
    update public.setups
      set game_version = repeat('x', 41)
      where id = 'c0a0000a-0000-4000-8000-00000000000a';
    raise exception 'REGRESSION: game_version accepted 41 characters';
  exception when check_violation then
    raise notice 'CHECK 1 passed: overlong game_version rejected';
  end;

  if (select game_version from public.setups
      where id = 'c0a0000a-0000-4000-8000-00000000000a') <> '1.6.2' then
    raise exception 'REGRESSION: valid game_version did not store';
  end if;
end $$;

\echo 'CHECK 2: create_setup_with_rating records the reported patch (empty -> null)'
begin;
set local role authenticated;
do $$
begin
  -- The publish path itself runs as authenticated (column-scoped insert
  -- grants must include game_version or this raises "permission denied").
  perform public.create_setup_with_rating(
    'Assetto Corsa Competizione', 'Porsche 992 GT3 R 2023', 'Spa-Francorchamps',
    'Dry', null, 'rpc patch setup', '{}'::text[], 'Wheel + 3 Pedals',
    null, null, null, null, null, null,
    null, null, '1.6'
  );
  perform public.create_setup_with_rating(
    'Assetto Corsa Competizione', 'Porsche 992 GT3 R 2023', 'Zandvoort',
    'Dry', null, 'rpc no patch', '{}'::text[], 'Wheel + 3 Pedals',
    null, null, null, null, null, null,
    null, null, ''
  );
  raise notice 'CHECK 2a passed: authenticated published two setups via the RPC';
end $$;
reset role;
do $$
declare
  v_stored text;
  v_blank text;
begin
  select game_version into v_stored from public.setups where description = 'rpc patch setup';
  if v_stored is distinct from '1.6' then
    raise exception 'REGRESSION: p_game_version not stored (got %)', v_stored;
  end if;

  select game_version into v_blank from public.setups where description = 'rpc no patch';
  if v_blank is not null then
    raise exception 'REGRESSION: empty p_game_version should store null (got %)', v_blank;
  end if;

  raise notice 'CHECK 2 passed: RPC stores the patch, empty becomes null';
end $$;
commit;

\echo 'CHECK 3: games_versions is readable but operator-write only'
begin;
set local role anon;
do $$
begin
  if not exists (
    select 1 from public.games_versions
  ) then
    -- Empty table is the honest starting state; presence of select rights is
    -- what matters here, so probe the grant with a zero-row read.
    perform count(*) from public.games_versions;
  end if;
  begin
    insert into public.games_versions (game, current_version)
    values ('Assetto Corsa Competizione', '9.9');
    raise exception 'REGRESSION: anon wrote games_versions';
  exception when insufficient_privilege then
    raise notice 'CHECK 3a passed: anon cannot write the current patch';
  end;
end $$;
reset role;
commit;

begin;
set local role authenticated;
do $$
begin
  begin
    insert into public.games_versions (game, current_version)
    values ('Assetto Corsa Competizione', '9.9');
    raise exception 'REGRESSION: authenticated wrote games_versions';
  exception when insufficient_privilege then
    raise notice 'CHECK 3b passed: authenticated cannot write the current patch';
  end;
end $$;
reset role;
commit;

do $$
begin
  insert into public.games_versions (game, current_version)
  values ('Assetto Corsa Competizione', '1.6.2')
  on conflict (game) do update
    set current_version = excluded.current_version, updated_at = now();
  raise notice 'CHECK 3c passed: operator path writes the current patch';
end $$;

\echo 'CHECK 4: an authenticated edit can change game_version and snapshots it'
begin;
set local role authenticated;
do $$
begin
  update public.setups
    set game_version = '1.7'
    where id = 'c0a0000a-0000-4000-8000-00000000000a';
  if not found then
    raise exception 'REGRESSION: authenticated update of game_version did not run';
  end if;
  raise notice 'CHECK 4a passed: authenticated edit writes game_version (update grant covers it)';
end $$;
reset role;
do $$
declare
  v_snapshot text;
begin
  select game_version into v_snapshot
  from public.setup_versions
  where setup_id = 'c0a0000a-0000-4000-8000-00000000000a'
  order by created_at desc
  limit 1;
  if v_snapshot <> '1.6.2' then
    raise exception 'REGRESSION: edit snapshot did not record the old game_version (got %)', v_snapshot;
  end if;
  raise notice 'CHECK 4 passed: edit snapshot recorded the old game_version';
end $$;
commit;

\echo 'CHECK 5: the browse search view exposes game_version'
do $$
declare
  v_seen text;
begin
  select game_version into v_seen
  from public.setup_search
  where id = 'c0a0000a-0000-4000-8000-00000000000a';
  if v_seen <> '1.7' then
    raise exception 'REGRESSION: setup_search lost game_version (got %)', v_seen;
  end if;
  raise notice 'CHECK 5 passed: setup_search carries game_version';
end $$;

\echo 'Game version checks passed.'
