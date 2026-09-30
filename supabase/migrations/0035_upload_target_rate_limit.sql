-- Replace the Vercel-process-local upload target limiter with an atomic,
-- shared per-user limiter. A single row per user is retained and its window
-- resets on the first request after the hour expires.
create table public.upload_target_rate_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count between 1 and 31)
);

alter table public.upload_target_rate_limits enable row level security;
revoke all on public.upload_target_rate_limits from public, anon, authenticated;

create or replace function public.consume_upload_target_rate_limit()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  if v_user_id is null then
    return false;
  end if;

  insert into public.upload_target_rate_limits as limits (
    user_id, window_started_at, request_count
  ) values (
    v_user_id, v_now, 1
  )
  on conflict (user_id) do update set
    window_started_at = case
      when limits.window_started_at <= v_now - interval '1 hour' then v_now
      else limits.window_started_at
    end,
    request_count = case
      when limits.window_started_at <= v_now - interval '1 hour' then 1
      else least(limits.request_count + 1, 31)
    end
  returning request_count into v_count;

  return v_count <= 30;
end;
$$;

revoke all on function public.consume_upload_target_rate_limit() from public, anon;
grant execute on function public.consume_upload_target_rate_limit() to authenticated;
