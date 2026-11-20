-- DRAFT: deploy only with the matching application/worker and isolated Storage
-- integration evidence. Ordinary client writes are intentionally closed.
-- Proposed account budget: 100 objects / 1 GiB, charged at the full 10 MiB
-- bucket ceiling per object, including reservations and pending deletion.
-- Existing objects are counted in place; no blobs or Storage rows are changed.
create schema setupsheet_storage_private;
revoke all on schema setupsheet_storage_private from public, anon, authenticated, service_role;

-- Existing signed upload capabilities can outlive an RLS cutover. Activation
-- requires an operator-verified drain; elapsed token TTL alone is not evidence
-- that already-started provider streams have finished. Fail closed by default.
create table setupsheet_storage_private.rollout (
  singleton boolean primary key default true check (singleton),
  legacy_drained_at timestamptz
);
insert into setupsheet_storage_private.rollout(singleton) values (true);
alter table setupsheet_storage_private.rollout enable row level security;
revoke all on setupsheet_storage_private.rollout from public, anon, authenticated, service_role;
create function setupsheet_storage_private.ensure_active()
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from setupsheet_storage_private.rollout where legacy_drained_at is not null) then
    raise exception 'Storage lifecycle rollout gate is closed' using errcode = '55000';
  end if;
end $$;
revoke all on function setupsheet_storage_private.ensure_active() from public, anon, authenticated, service_role;

create table setupsheet_storage_private.objects (
  path text primary key check (char_length(path) between 1 and 512),
  owner_id uuid not null,
  reservation_id uuid not null unique default gen_random_uuid(),
  upload_kind text check (upload_kind in ('setup', 'telemetry')),
  reserved_bytes bigint not null default 10485760 check (reserved_bytes >= 10485760),
  charge_unknown boolean not null default false,
  state text not null check (state in ('reserved', 'issuing', 'ready', 'deleting', 'deleted')),
  upload_deadline timestamptz not null default 'infinity',
  claim_id uuid unique,
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  check ((state in ('deleting', 'deleted')) = (claim_id is not null))
);
create index storage_objects_owner_state_idx
on setupsheet_storage_private.objects (owner_id, state);
alter table setupsheet_storage_private.objects enable row level security;
revoke all on setupsheet_storage_private.objects from public, anon, authenticated, service_role;

-- A quota decision and its reservation commit together under one account lock.
-- No client-declared file size enters this calculation. UNION counts uploaded
-- reservations only once and includes legacy objects that have no ledger row.
create function public.reserve_storage_upload(p_owner uuid, p_path text, p_kind text)
returns uuid language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare
  slots bigint;
  held_bytes numeric;
  unknown_size boolean;
  result uuid;
begin
  perform setupsheet_storage_private.ensure_active();
  if p_kind is null or p_kind not in ('setup','telemetry')
     or p_owner is null or not exists (select 1 from public.profiles where id = p_owner)
     or p_path is null or char_length(p_path) > 512
     or split_part(p_path, '/', 1) <> p_owner::text
     or p_path !~ '^[0-9a-f-]{36}/(telemetry-)?[0-9a-f-]{36}-[A-Za-z0-9._-]{1,255}$'
     or (p_kind = 'setup' and lower(p_path) !~ '\.(sto|json|ini|svm|sav|txt|xml|csv)$')
     or (p_kind = 'telemetry' and lower(p_path) !~ '\.(ld|ldx|ibt|vbo|drf|csv|zip|zvp|telemetry)$') then
    raise exception 'Invalid upload reservation' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(17376, pg_catalog.hashtext(p_owner::text));
  with charged as (
    select name as path,
      case when metadata->>'size' ~ '^[0-9]{1,18}$'
        then greatest(10485760::bigint, (metadata->>'size')::bigint)
        else null end as capacity
    from storage.objects
    where bucket_id = 'setup-files' and name like p_owner::text || '/%'
    union all
    select path, case when charge_unknown then null else reserved_bytes end from setupsheet_storage_private.objects
    where owner_id = p_owner and state <> 'deleted'
  ), per_path as (
    select path, max(capacity) as capacity, bool_or(capacity is null) as missing_size
    from charged group by path
  )
  select count(*), coalesce(sum(capacity),0), coalesce(bool_or(missing_size),false)
  into slots, held_bytes, unknown_size from per_path;
  if unknown_size then
    raise exception 'Storage size inventory unavailable' using errcode = 'P0001';
  end if;
  if slots >= 100 or held_bytes + 10485760::bigint > 1073741824::bigint then
    raise exception 'Storage quota exceeded' using errcode = 'P0001';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'setup-files' and name = p_path) then
    raise exception 'Upload path already exists' using errcode = '23505';
  end if;
  insert into setupsheet_storage_private.objects(path, owner_id, upload_kind, state, upload_deadline)
  values (p_path, p_owner, p_kind, 'reserved', clock_timestamp() + interval '15 minutes') returning reservation_id into result;
  return result;
end $$;

-- One-use application ticket. No Storage capability is sent to the client.
-- A request that has begun can never be reclaimed by time alone: provider
-- upload completion may be uncertain after a timeout or process crash.
create function public.begin_storage_upload(p_reservation uuid, p_owner uuid)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare result jsonb;
begin
  perform setupsheet_storage_private.ensure_active();
  update setupsheet_storage_private.objects
  set state = 'issuing', upload_deadline = 'infinity'
  where reservation_id = p_reservation and owner_id = p_owner
    and state = 'reserved' and upload_deadline > clock_timestamp()
    and exists (select 1 from public.profiles where id = p_owner)
  returning jsonb_build_object('path',path,'kind',upload_kind) into result;
  return result;
end $$;

-- Acknowledged non-upsert upload only; metadata must exist. No external signed
-- token or second upload request can outlive this transition.
create function public.complete_storage_upload(p_reservation uuid)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
begin
  update setupsheet_storage_private.objects l
  set state = 'ready', upload_deadline = '-infinity'
  where l.reservation_id = p_reservation and l.state = 'issuing'
    and exists (select 1 from storage.objects o where o.bucket_id = 'setup-files' and o.name = l.path);
  if found then return true; end if;
  return exists (select 1 from setupsheet_storage_private.objects l
                where l.reservation_id = p_reservation and l.state = 'ready'
                  and exists(select 1 from storage.objects o where o.bucket_id='setup-files' and o.name=l.path));
end $$;

-- Both current attachments and history snapshots must acquire the same path
-- locks BEFORE becoming visible. All old/new paths are locked in sorted order,
-- so a content edit and its snapshot do not acquire them in opposite orders.
create function setupsheet_storage_private.guard_attachments()
returns trigger language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare
  paths text[] := array[new.file_path, new.telemetry_file_path];
  object_path text;
  object_state text;
begin
  if tg_op = 'UPDATE' then
    paths := paths || array[old.file_path, old.telemetry_file_path];
  end if;
  for object_path in select distinct p from unnest(paths) as p where p is not null order by p loop
    perform pg_catalog.pg_advisory_xact_lock(17377, pg_catalog.hashtext(object_path));
  end loop;
  for object_path in select distinct p from unnest(array[new.file_path, new.telemetry_file_path]) as p
                     where p is not null order by p loop
    if object_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$' then
      raise exception 'Invalid attachment path' using errcode = '23514';
    end if;
    -- Conflict handling + row locking also fail closed for a REPEATABLE READ
    -- snapshot that predates a cleanup claim. Never treat an invisible
    -- concurrently inserted tombstone as an untracked legacy path.
    insert into setupsheet_storage_private.objects(path, owner_id, state, upload_deadline)
    values (object_path, split_part(object_path, '/', 1)::uuid, 'ready', '-infinity')
    on conflict (path) do nothing;
    select state into object_state from setupsheet_storage_private.objects
    where path = object_path for update;
    if not found then raise exception 'Retry attachment snapshot' using errcode = '40001'; end if;
    if object_state <> 'ready' then
      raise exception 'File is unavailable for attachment' using errcode = '23514';
    end if;
  end loop;
  return new;
end $$;
create trigger a_storage_attachment_guard before insert or update of file_path, telemetry_file_path on public.setups
for each row execute function setupsheet_storage_private.guard_attachments();
create trigger a_storage_attachment_guard before insert or update of file_path, telemetry_file_path on public.setup_versions
for each row execute function setupsheet_storage_private.guard_attachments();

-- Read-only bounded inventory; apply MUST recheck under a claim lock.
create function public.storage_cleanup_candidates(
  p_grace interval default interval '24 hours', p_user uuid default null
) returns table(object_name text)
language plpgsql stable security definer set search_path = '' set lock_timeout = '5s' as $$
begin
  if p_grace is null or p_grace < interval '24 hours' or p_grace > interval '30 days' then
    raise exception 'Invalid cleanup grace' using errcode = '22023';
  end if;
  return query
    select candidates.path from (
      select o.name as path, o.created_at from storage.objects o where o.bucket_id = 'setup-files'
      union
      select l.path, l.created_at from setupsheet_storage_private.objects l where l.state <> 'deleted'
    ) candidates
    left join setupsheet_storage_private.objects l on l.path = candidates.path
    where candidates.created_at < statement_timestamp() - p_grace
      and (p_user is null or split_part(candidates.path, '/', 1) = p_user::text)
      and (l.path is null or (l.state in ('reserved', 'ready', 'deleting') and l.upload_deadline < statement_timestamp()))
      and not exists (select 1 from public.setups s
                      where s.file_path = candidates.path or s.telemetry_file_path = candidates.path)
      and not exists (select 1 from public.setup_versions v
                      where v.file_path = candidates.path or v.telemetry_file_path = candidates.path)
    group by candidates.path order by candidates.path limit 1000;
end $$;

create function public.claim_storage_cleanup(
  p_path text, p_grace interval default interval '24 hours', p_user uuid default null
) returns uuid language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare
  item setupsheet_storage_private.objects%rowtype;
  object_created timestamptz;
  object_metadata jsonb;
  object_exists boolean;
  object_capacity bigint;
  result uuid;
begin
  perform setupsheet_storage_private.ensure_active();
  if p_path is null or char_length(p_path) > 512
     or p_path !~ '^[0-9a-f-]{36}/[^/]+$' or p_path ~ '[\\[:cntrl:]]'
     or (p_user is not null and split_part(p_path, '/', 1) <> p_user::text)
     or p_grace is null or p_grace < interval '24 hours' or p_grace > interval '30 days' then
    raise exception 'Invalid cleanup request' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(17377, pg_catalog.hashtext(p_path));
  select created_at, metadata into object_created, object_metadata from storage.objects
  where bucket_id = 'setup-files' and name = p_path;
  object_exists := found;
  insert into setupsheet_storage_private.objects(path, owner_id, state, upload_deadline, created_at)
  values (p_path, split_part(p_path, '/', 1)::uuid, 'ready', '-infinity',
          coalesce(object_created, clock_timestamp())) on conflict (path) do nothing;
  select * into item from setupsheet_storage_private.objects where path = p_path for update;
  if not found then raise exception 'Retry cleanup snapshot' using errcode = '40001'; end if;
  if item.state = 'deleted' or item.state = 'issuing'
     or item.upload_deadline >= clock_timestamp()
     or greatest(item.created_at, object_created) >= clock_timestamp() - p_grace then
    return null;
  end if;
  if exists (select 1 from public.setups where file_path = p_path or telemetry_file_path = p_path)
     or exists (select 1 from public.setup_versions where file_path = p_path or telemetry_file_path = p_path) then
    return null;
  end if;
  -- Keep a large legacy object's full charge after Storage metadata removal,
  -- until finalization. Unknown metadata remains a fail-closed charge too.
  if object_exists then
    object_capacity := case when object_metadata->>'size' ~ '^[0-9]{1,18}$'
      then greatest(10485760::bigint,(object_metadata->>'size')::bigint) else null end;
    update setupsheet_storage_private.objects
    set reserved_bytes = greatest(reserved_bytes,coalesce(object_capacity,10485760)),
        charge_unknown = object_capacity is null
    where path = p_path;
  end if;
  if item.state = 'deleting' then return item.claim_id; end if;
  result := gen_random_uuid();
  update setupsheet_storage_private.objects set state = 'deleting', claim_id = result where path = p_path;
  return result;
end $$;

-- Never reopen a path after an uncertain Storage delete. The permanent claim
-- and tombstone let retries finish safely without attaching or re-signing it.
create function public.finish_storage_cleanup(p_path text, p_claim uuid)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare item setupsheet_storage_private.objects%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(17377, pg_catalog.hashtext(p_path));
  select * into item from setupsheet_storage_private.objects where path = p_path for update;
  if not found or item.claim_id is distinct from p_claim or p_claim is null then
    raise exception 'Invalid cleanup claim' using errcode = '22023';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'setup-files' and name = p_path) then
    return false;
  end if;
  if exists (select 1 from public.setups where file_path = p_path or telemetry_file_path = p_path)
     or exists (select 1 from public.setup_versions where file_path = p_path or telemetry_file_path = p_path) then
    raise exception 'Cleanup reference invariant violated';
  end if;
  update setupsheet_storage_private.objects set state = 'deleted', deleted_at = coalesce(deleted_at, clock_timestamp())
  where path = p_path;
  return true;
end $$;

revoke all on function public.reserve_storage_upload(uuid,text,text) from public, anon, authenticated;
revoke all on function public.begin_storage_upload(uuid,uuid) from public, anon, authenticated;
revoke all on function public.complete_storage_upload(uuid) from public, anon, authenticated;
revoke all on function public.storage_cleanup_candidates(interval,uuid) from public, anon, authenticated;
revoke all on function public.claim_storage_cleanup(text,interval,uuid) from public, anon, authenticated;
revoke all on function public.finish_storage_cleanup(text,uuid) from public, anon, authenticated;
revoke all on function setupsheet_storage_private.guard_attachments() from public, anon, authenticated, service_role;
grant execute on function public.reserve_storage_upload(uuid,text,text),
  public.begin_storage_upload(uuid,uuid), public.complete_storage_upload(uuid), public.storage_cleanup_candidates(interval,uuid),
  public.claim_storage_cleanup(text,interval,uuid), public.finish_storage_cleanup(text,uuid) to service_role;

-- Fail closed if another permissive write policy could bypass trusted upload
-- or claimed deletion. Preserve the public read policy and managed schema.
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'setup-files'
                 and file_size_limit between 1 and 10485760) then
    raise exception 'Review Storage bucket ceiling before quota rollout';
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('INSERT','UPDATE','DELETE','ALL')) <> 3
     or (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
         and roles::text = '{authenticated}' and permissive = 'PERMISSIVE'
         and ((cmd = 'INSERT' and policyname = 'Users can upload setup files to their own folder')
           or (cmd = 'UPDATE' and policyname = 'Users can update their own setup files')
           or (cmd = 'DELETE' and policyname = 'Users can delete their own setup files'))) <> 3 then
    raise exception 'Review unexpected Storage write policies before rollout';
  end if;
end $$;
drop policy "Users can upload setup files to their own folder" on storage.objects;
drop policy "Users can update their own setup files" on storage.objects;
drop policy "Users can delete their own setup files" on storage.objects;
