-- Regression coverage for 0028_setup_files_gc.sql: the retention helpers must
-- report exactly the objects that no row references, and leave in-flight
-- uploads and history-referenced objects alone.

insert into auth.users (id, email, raw_user_meta_data)
values ('66666666-6666-4666-8666-666666666666', 'gc@example.com', '{"full_name":"gc"}'::jsonb);

-- Pin the caller identity: 0021's setup-creation rate-limit trigger counts
-- inserts for auth.uid(), and the other test files leave their own value here.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select '66666666-6666-4666-8666-666666666666'::uuid $$;

-- One setup that legitimately owns its file...
insert into public.setups
  (id, user_id, game, car, track, condition, description, tags, rig_profile, file_path, file_name)
values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '66666666-6666-4666-8666-666666666666',
   'iRacing', 'BMW M4 GT3', 'Spa-Francorchamps', 'Dry', 'gc fixture', '{}', 'Wheel + 3 Pedals',
   '66666666-6666-4666-8666-666666666666/kept.sto', 'kept.sto');

-- ...and three storage objects: referenced, unreferenced-but-old (garbage),
-- and unreferenced-but-fresh (still inside the grace window).
insert into storage.objects (bucket_id, name, owner, created_at) values
  ('setup-files', '66666666-6666-4666-8666-666666666666/kept.sto',
   '66666666-6666-4666-8666-666666666666', now() - interval '7 days'),
  ('setup-files', '66666666-6666-4666-8666-666666666666/orphan.sto',
   '66666666-6666-4666-8666-666666666666', now() - interval '7 days'),
  ('setup-files', '66666666-6666-4666-8666-666666666666/fresh.sto',
   '66666666-6666-4666-8666-666666666666', now());

\echo 'CHECK 1: orphan enumeration returns only stale unreferenced objects'
do $$
declare
  v_names text[];
begin
  select array_agg(object_name order by object_name)
    into v_names
    from public.orphaned_setup_files(interval '24 hours')
    where owner_folder = '66666666-6666-4666-8666-666666666666';

  if v_names is distinct from array['66666666-6666-4666-8666-666666666666/orphan.sto'] then
    raise exception 'REGRESSION: orphaned_setup_files returned %',
      coalesce(array_to_string(v_names, ','), 'null');
  end if;
  raise notice 'CHECK 1 passed';
end $$;

\echo 'CHECK 2: account-deletion helper lists the whole folder, referenced or not'
do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from public.setup_files_for_user('66666666-6666-4666-8666-666666666666');

  if v_count <> 3 then
    raise exception 'REGRESSION: expected 3 objects for the account, got %', v_count;
  end if;
  raise notice 'CHECK 2 passed';
end $$;

\echo 'Storage retention helper checks passed.'
