-- Metadata-only disposable database test. This does not upload Storage blobs.
begin;
-- Exercise the earlier repair in an isolated transaction even when the later
-- lifecycle migration has intentionally removed ordinary client write policies.
\ir ../migrations/0019_storage_extension_hardening.sql
create temporary table storage_policy_before as
select * from pg_catalog.pg_policies where schemaname = 'storage' and tablename = 'objects';
-- Reproduce the verified hosted drift, then reconcile it additively.
alter policy "Users can upload setup files to their own folder" on storage.objects
with check (bucket_id = 'setup-files' and (storage.foldername(name))[1] = auth.uid()::text);
alter policy "Users can update their own setup files" on storage.objects
using (bucket_id = 'setup-files' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'setup-files' and (storage.foldername(name))[1] = auth.uid()::text);
\ir ../migrations/20261120151501_reconcile_storage_extension_policies.sql
\ir ../migrations/20261120151501_reconcile_storage_extension_policies.sql
do $$
begin
  if exists ((select * from pg_policies where schemaname = 'storage' and tablename = 'objects'
              except select * from storage_policy_before)
             union all
             (select * from storage_policy_before except
              select * from pg_policies where schemaname = 'storage' and tablename = 'objects')) then
    raise exception 'REGRESSION: reconciliation differs from reviewed 0019 policies';
  end if;
end $$;

-- A second permissive policy could bypass the extension gate: fail closed.
create policy unsafe_extension_bypass on storage.objects for insert to authenticated with check (true);
savepoint extra_policy_probe;
\set ON_ERROR_STOP off
\ir ../migrations/20261120151501_reconcile_storage_extension_policies.sql
\set extra_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
rollback to savepoint extra_policy_probe;
select :'extra_sqlstate' = 'P0001' as extra_rejected \gset
\if :extra_rejected
\else
  do $$ begin raise exception 'REGRESSION: extra write policy was accepted'; end $$;
\endif
drop policy unsafe_extension_bypass on storage.objects;

-- Give API roles the normal platform table grants, so denial is RLS, not
-- an accidentally missing table/schema privilege in the minimal test shim.
grant usage on schema storage to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated, anon;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare ext text; invalid_name text; affected integer;
begin
  foreach ext in array array['sto','json','ini','svm','sav','txt','xml','csv',
                            'ld','ldx','ibt','vbo','drf','zip','zvp','telemetry'] loop
    insert into storage.objects(bucket_id, name) values
      ('setup-files', auth.uid()::text || '/compat.' || upper(ext));
  end loop;
  foreach invalid_name in array array[
    '62000000-0000-4000-8000-000000000001/payload.html',
    '62000000-0000-4000-8000-000000000001/payload.js',
    '62000000-0000-4000-8000-000000000001/setup.json.html',
    '62000000-0000-4000-8000-000000000002/foreign.json'] loop
    begin
      insert into storage.objects(bucket_id, name) values ('setup-files', invalid_name);
      raise exception 'REGRESSION: disallowed object insert accepted: %', invalid_name;
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    insert into storage.objects(bucket_id, name) values
      ('other-bucket', auth.uid()::text || '/setup.json');
    raise exception 'REGRESSION: other bucket write accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    update storage.objects set name = auth.uid()::text || '/renamed.html'
    where name = auth.uid()::text || '/compat.JSON';
    raise exception 'REGRESSION: rename bypassed extension WITH CHECK';
  exception when insufficient_privilege then null;
  end;
  begin
    update storage.objects set name = '62000000-0000-4000-8000-000000000002/renamed.json'
    where name = auth.uid()::text || '/compat.JSON';
    raise exception 'REGRESSION: rename bypassed ownership WITH CHECK';
  exception when insufficient_privilege then null;
  end;
  update storage.objects set name = auth.uid()::text || '/renamed.json'
  where name = auth.uid()::text || '/compat.JSON';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'REGRESSION: valid owner update failed'; end if;
end $$;
select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000002', true);
do $$
declare affected integer;
begin
  update storage.objects set name = auth.uid()::text || '/stolen.json'
  where name = '62000000-0000-4000-8000-000000000001/renamed.json';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'REGRESSION: foreign update allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    insert into storage.objects(bucket_id, name) values
      ('setup-files', '62000000-0000-4000-8000-000000000001/no-jwt.json');
    raise exception 'REGRESSION: missing JWT insert accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role anon;
-- Even an identity-shaped claim must not give the anonymous role write access.
select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000001', true);
do $$
begin
  begin
    insert into storage.objects(bucket_id, name) values
      ('setup-files', auth.uid()::text || '/anonymous.json');
    raise exception 'REGRESSION: anonymous insert accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
