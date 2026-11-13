-- 0046_trusted_download_counter.sql
-- SS-AUD-003: public downloads must work anonymously, but anonymous clients
-- must not receive direct EXECUTE on a SECURITY DEFINER write helper.
-- The server action calls this RPC using a server-only service credential.
-- A global per-setup/day cap limits artificial count inflation and avoids
-- retaining IP addresses, user agents, or other visitor identifiers.

create schema if not exists app_private;
revoke all on schema app_private from PUBLIC, anon, authenticated;

create table app_private.setup_download_daily_windows (
  setup_id uuid not null references public.setups(id) on delete cascade,
  day_utc date not null,
  increment_count integer not null default 0 check(increment_count between 0 and 1000),
  primary key(setup_id, day_utc)
);
alter table app_private.setup_download_daily_windows enable row level security;
revoke all on app_private.setup_download_daily_windows from PUBLIC, anon, authenticated;

create or replace function public.increment_downloads(setup_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_accepted boolean;
begin
  if setup_id is null then return; end if;

  insert into app_private.setup_download_daily_windows (setup_id,day_utc,increment_count)
  select s.id,(now() at time zone 'utc')::date,1
  from public.setups s where s.id=setup_id
  on conflict on constraint setup_download_daily_windows_pkey
  do update set increment_count = app_private.setup_download_daily_windows.increment_count + 1
  where app_private.setup_download_daily_windows.increment_count < 1000
  returning true into v_accepted;

  if coalesce(v_accepted,false) then
    update public.setups as s
      set downloads=s.downloads+1
      where s.id=setup_id;
  end if;
end;
$$;

revoke execute on function public.increment_downloads(uuid) from PUBLIC, anon, authenticated;
grant execute on function public.increment_downloads(uuid) to service_role;
