-- Minimal user-facing moderation intake. Reports are private to the reporter;
-- trusted operators review them with the service role or SQL editor. The app
-- never grants contributors permission to change moderation status.

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('setup', 'comment', 'profile')),
  target_id uuid not null,
  reason text not null check (reason in (
    'spam', 'unsafe_file', 'harassment', 'copyright', 'other'
  )),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'pending' check (status in (
    'pending', 'reviewing', 'resolved', 'dismissed'
  )),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index content_reports_active_reporter_target_idx
  on public.content_reports (reporter_id, target_type, target_id)
  where status in ('pending', 'reviewing');

create index content_reports_status_created_at_idx
  on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;

create policy "Users can submit reports as themselves"
  on public.content_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

create policy "Users can view their own reports"
  on public.content_reports for select
  to authenticated
  using (auth.uid() = reporter_id);

revoke all on public.content_reports from anon, authenticated;
grant insert (reporter_id, target_type, target_id, reason, details)
  on public.content_reports to authenticated;
grant select (id, reporter_id, target_type, target_id, reason, details, status, created_at, reviewed_at)
  on public.content_reports to authenticated;

-- Stop a single authenticated account from flooding the moderation queue.
create function public.enforce_content_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select count(*) into v_count
    from public.content_reports
    where reporter_id = v_user_id
      and created_at >= now() - interval '1 hour';

  if v_count >= 20 then
    raise exception 'Report rate limit reached; try again later';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_content_report_rate_limit() from public;

create trigger content_reports_rate_limit
  before insert on public.content_reports
  for each row execute function public.enforce_content_report_rate_limit();
