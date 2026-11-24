-- Metadata fixtures only. Hosted signed-token/blob behavior remains a release gate.
begin;
-- The deployed migration must not accidentally enable a legacy-capability
-- cutover. Only this disposable fixture activates it after proving the gate.
do $$
begin
  begin
    perform public.claim_storage_cleanup('72000000-0000-4000-8000-000000000001/legacy.json');
    raise exception 'REGRESSION: rollout gate opened automatically';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
update setupsheet_storage_private.rollout set legacy_drained_at=clock_timestamp();
insert into auth.users(id,email) values
 ('72000000-0000-4000-8000-000000000001','storage-lifecycle@test.local');
create or replace function auth.uid() returns uuid language sql stable as
$$ select '72000000-0000-4000-8000-000000000001'::uuid $$;

-- Platform grants are present so writes fail because of RLS, not missing grants.
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
insert into storage.objects(bucket_id,name,created_at) values
 ('setup-files','72000000-0000-4000-8000-000000000001/legacy.json',now()-interval '7 days');
set local role authenticated;
do $$
declare affected integer;
begin
  begin
    insert into storage.objects(bucket_id,name) values
      ('setup-files',auth.uid()::text || '/direct.json');
    raise exception 'REGRESSION: direct upload bypassed reservation';
  exception when insufficient_privilege then null; end;
  update storage.objects set name=auth.uid()::text || '/renamed.json'
  where name=auth.uid()::text || '/legacy.json';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'REGRESSION: direct overwrite allowed'; end if;
  delete from storage.objects where name=auth.uid()::text || '/legacy.json';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'REGRESSION: direct deletion bypassed claim'; end if;
end $$;
reset role;

do $$
declare proc regprocedure; role_name text;
begin
  foreach proc in array array[
    'public.reserve_storage_upload(uuid,text,text)'::regprocedure,
    'public.begin_storage_upload(uuid,uuid)'::regprocedure,
    'public.complete_storage_upload(uuid)'::regprocedure,
    'public.storage_cleanup_candidates(interval,uuid)'::regprocedure,
    'public.claim_storage_cleanup(text,interval,uuid)'::regprocedure,
    'public.finish_storage_cleanup(text,uuid)'::regprocedure
  ] loop
    foreach role_name in array array['anon','authenticated'] loop
      if has_function_privilege(role_name,proc,'EXECUTE') then
        raise exception 'REGRESSION: % can execute %', role_name,proc;
      end if;
    end loop;
    if not has_function_privilege('service_role',proc,'EXECUTE') then
      raise exception 'REGRESSION: worker cannot execute %',proc;
    end if;
  end loop;
  if has_schema_privilege('authenticated','setupsheet_storage_private','USAGE') then
    raise exception 'REGRESSION: client can access private ledger';
  end if;
end $$;

-- Tickets are one-use and owner-bound; upload completion is acknowledged only
-- after actual Storage metadata is present. No provider token is ever issued.
set local role service_role;
select public.reserve_storage_upload('72000000-0000-4000-8000-000000000001',
 '72000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000002-test.json','setup') as reservation \gset
select public.begin_storage_upload(:'reservation','72000000-0000-4000-8000-000000000099') is null as wrong_owner \gset
\if :wrong_owner
\else
 do $$ begin raise exception 'REGRESSION: foreign ticket redemption'; end $$;
\endif
select public.begin_storage_upload(:'reservation','72000000-0000-4000-8000-000000000001');
select public.begin_storage_upload(:'reservation','72000000-0000-4000-8000-000000000001') is null as replay_blocked \gset
\if :replay_blocked
\else
 do $$ begin raise exception 'REGRESSION: upload ticket replay'; end $$;
\endif
select not public.complete_storage_upload(:'reservation') as premature_blocked \gset
\if :premature_blocked
\else
 do $$ begin raise exception 'REGRESSION: completion without uploaded metadata'; end $$;
\endif
reset role;
do $$
begin
  if not exists(select 1 from setupsheet_storage_private.objects where state='issuing'
    and upload_deadline='infinity' and owner_id='72000000-0000-4000-8000-000000000001') then
    raise exception 'REGRESSION: uncertain upload was not protected';
  end if;
end $$;

-- Quota counts a union of existing blobs and ledger paths. Uploading a reserved
-- object must NOT double-charge its slot, and changing its size claim cannot
-- lower its fixed 10 MiB charge.
insert into storage.objects(bucket_id,name) values
 ('setup-files','72000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000002-test.json');
select public.complete_storage_upload(:'reservation');
select public.complete_storage_upload(:'reservation');
insert into setupsheet_storage_private.objects(path,owner_id,state,upload_deadline)
select '72000000-0000-4000-8000-000000000001/' || gen_random_uuid() || '-quota.json',
 '72000000-0000-4000-8000-000000000001','ready','-infinity' from generate_series(1,97);
-- 99 slots: one legacy object, one uploaded reservation, 97 pending reservations.
select public.reserve_storage_upload('72000000-0000-4000-8000-000000000001',
 '72000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000003-last.json','setup');
do $$
begin
  begin
    perform public.reserve_storage_upload('72000000-0000-4000-8000-000000000001',
      '72000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000004-overflow.json','setup');
    raise exception 'REGRESSION: quota overflow accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Storage quota exceeded' then raise; end if;
  end;
end $$;

-- An expired ticket that never began an upload has no provider operation.
-- It can be retired safely, but its old ticket can never start a later upload.
update setupsheet_storage_private.objects set created_at=now()-interval '7 days',upload_deadline=now()-interval '1 hour'
where path='72000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000003-last.json';
select public.claim_storage_cleanup('72000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000003-last.json') as expired_claim \gset
select public.finish_storage_cleanup('72000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000003-last.json',:'expired_claim');
do $$
begin
  if public.begin_storage_upload(
    (select reservation_id from setupsheet_storage_private.objects where path='72000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000003-last.json'),
    '72000000-0000-4000-8000-000000000001') is not null then
    raise exception 'REGRESSION: a retired ticket started an upload';
  end if;
end $$;

-- Legacy files larger than today's bucket cap must be charged by their
-- provider metadata, and unknown metadata must not create free capacity.
insert into auth.users(id,email) values ('72000000-0000-4000-8000-000000000006','legacy-size@test.local');
insert into storage.objects(bucket_id,name,metadata) values
 ('setup-files','72000000-0000-4000-8000-000000000006/legacy.sto','{"size":1073741824}');
do $$
begin
  begin
    perform public.reserve_storage_upload('72000000-0000-4000-8000-000000000006',
      '72000000-0000-4000-8000-000000000006/72000000-0000-4000-8000-000000000007-test.json','setup');
    raise exception 'REGRESSION: large legacy object was undercharged';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Storage quota exceeded' then raise; end if;
  end;
end $$;
update storage.objects set metadata=null where name='72000000-0000-4000-8000-000000000006/legacy.sto';
do $$
begin
  begin
    perform public.reserve_storage_upload('72000000-0000-4000-8000-000000000006',
      '72000000-0000-4000-8000-000000000006/72000000-0000-4000-8000-000000000007-test.json','setup');
    raise exception 'REGRESSION: missing size metadata was accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Storage size inventory unavailable' then raise; end if;
  end;
end $$;

-- A large legacy object's charge survives the API/metadata-removal window.
update storage.objects set metadata='{"size":1073741824}',created_at=now()-interval '7 days'
where name='72000000-0000-4000-8000-000000000006/legacy.sto';
select public.claim_storage_cleanup('72000000-0000-4000-8000-000000000006/legacy.sto') as large_claim \gset
-- Disposable metadata-only stand-in for an acknowledged Storage removal.
delete from storage.objects where name='72000000-0000-4000-8000-000000000006/legacy.sto';
do $$
begin
  begin
    perform public.reserve_storage_upload('72000000-0000-4000-8000-000000000006',
      '72000000-0000-4000-8000-000000000006/72000000-0000-4000-8000-000000000007-test.json','setup');
    raise exception 'REGRESSION: pending deletion released a legacy byte charge';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Storage quota exceeded' then raise; end if;
  end;
end $$;
select public.finish_storage_cleanup('72000000-0000-4000-8000-000000000006/legacy.sto',:'large_claim');
select public.reserve_storage_upload('72000000-0000-4000-8000-000000000006',
 '72000000-0000-4000-8000-000000000006/72000000-0000-4000-8000-000000000007-test.json','setup');

-- Claiming imported legacy objects coordinates with attachment guards. A
-- Storage error does not undo the claim; retries receive the same claim id.
select public.claim_storage_cleanup('72000000-0000-4000-8000-000000000001/legacy.json') as claim \gset
select public.claim_storage_cleanup('72000000-0000-4000-8000-000000000001/legacy.json')=:'claim'::uuid as retry_same \gset
\if :retry_same
\else
  do $$ begin raise exception 'REGRESSION: claim changed on retry'; end $$;
\endif
do $$
begin
  begin
    insert into public.setups(user_id,game,car,track,condition,description,tags,rig_profile,file_path,file_name)
    values ('72000000-0000-4000-8000-000000000001','iRacing','Test','Test','Dry','test','{}','Gamepad',
            '72000000-0000-4000-8000-000000000001/legacy.json','legacy.json');
    raise exception 'REGRESSION: claimed file was attached';
  exception when check_violation then null; end;
end $$;
select not public.finish_storage_cleanup('72000000-0000-4000-8000-000000000001/legacy.json',:'claim') as not_released \gset
\if :not_released
\else
  do $$ begin raise exception 'REGRESSION: quota freed before metadata deletion'; end $$;
\endif
-- Only the disposable shim removes metadata directly to simulate Storage API
-- success. The application and worker must NEVER issue this SQL on Supabase.
delete from storage.objects where name='72000000-0000-4000-8000-000000000001/legacy.json';
select public.finish_storage_cleanup('72000000-0000-4000-8000-000000000001/legacy.json',:'claim');
select public.finish_storage_cleanup('72000000-0000-4000-8000-000000000001/legacy.json',:'claim');
do $$
begin
  if not exists(select 1 from setupsheet_storage_private.objects where state='deleted'
                and path='72000000-0000-4000-8000-000000000001/legacy.json') then
    raise exception 'REGRESSION: permanent tombstone missing';
  end if;
end $$;
-- History-only references remain protected after the current file is cleared.
insert into storage.objects(bucket_id,name,created_at) values
 ('setup-files','72000000-0000-4000-8000-000000000001/history.json',now()-interval '7 days');
insert into public.setups(id,user_id,game,car,track,condition,description,tags,rig_profile,file_path,file_name)
values ('72000000-0000-4000-8000-000000000005','72000000-0000-4000-8000-000000000001',
 'iRacing','Test','Test','Dry','history','{}','Gamepad',
 '72000000-0000-4000-8000-000000000001/history.json','history.json');
update setupsheet_storage_private.objects set created_at=now()-interval '7 days'
where path='72000000-0000-4000-8000-000000000001/history.json';
update public.setups set file_path=null,file_name=null
where id='72000000-0000-4000-8000-000000000005';
do $$
begin
  if public.claim_storage_cleanup('72000000-0000-4000-8000-000000000001/history.json') is not null then
    raise exception 'REGRESSION: history-referenced file was claimed';
  end if;
  -- Tombstones also protect privileged history writes, not just the browser.
  begin
    update public.setup_versions set file_path='72000000-0000-4000-8000-000000000001/legacy.json'
    where setup_id='72000000-0000-4000-8000-000000000005';
    raise exception 'REGRESSION: history attached a tombstoned file';
  exception when check_violation then null; end;
end $$;
rollback;
