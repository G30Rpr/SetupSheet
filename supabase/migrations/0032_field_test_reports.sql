-- Field tests are server-derived from an owned Garage session and exposed
-- only through an explicit public projection. The existing no-login Garage
-- writer role remains the only role that can create or update report rows.

begin;

create table public.field_test_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  garage_session_id uuid not null references public.garage_sessions (id) on delete cascade,
  setup_id uuid not null references public.setups (id) on delete cascade,
  report_day_utc date not null default ((now() at time zone 'UTC')::date),
  game text not null check (game in ('Assetto Corsa Competizione', 'Le Mans Ultimate')),
  condition text not null check (condition in ('Dry', 'Wet', 'Mixed')),
  validated_changes jsonb not null
    check (jsonb_typeof(validated_changes) = 'array' and jsonb_array_length(validated_changes) > 0),
  laps_run integer not null check (laps_run >= 1),
  consistency_pct numeric(4, 1) check (consistency_pct is null or consistency_pct between 0 and 100),
  best_lap_ms integer not null check (best_lap_ms between 10000 and 1800000),
  note text not null default '' check (char_length(note) <= 1000),
  show_name boolean not null default false,
  display_name_snapshot text,
  created_at timestamptz not null default now(),
  constraint field_test_reports_user_setup_day_key unique (user_id, setup_id, report_day_utc)
);

create index field_test_reports_setup_created_idx
  on public.field_test_reports (setup_id, created_at desc, id desc);

alter table public.field_test_reports enable row level security;

create policy "Garage writer can read own field-test reports"
  on public.field_test_reports for select to setupsheet_garage_writer
  using (user_id = auth.uid());

create policy "Garage writer can create own field-test reports"
  on public.field_test_reports for insert to setupsheet_garage_writer
  with check (user_id = auth.uid());

create policy "Garage writer can update own field-test attribution"
  on public.field_test_reports for update to setupsheet_garage_writer
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.field_test_reports from PUBLIC, anon, authenticated, setupsheet_garage_writer;
grant select on public.field_test_reports to setupsheet_garage_writer;
grant insert (
  user_id, garage_session_id, setup_id, game, condition,
  validated_changes, laps_run, consistency_pct, best_lap_ms, note
) on public.field_test_reports to setupsheet_garage_writer;
grant update (show_name, display_name_snapshot) on public.field_test_reports to setupsheet_garage_writer;
grant select (id, username) on public.profiles to setupsheet_garage_writer;

-- The private RPC owner may read only the Garage fields it needs. Parent-row
-- RLS remains the ownership boundary; no browser role gains child-table access.
grant select (session_id, lap_time_ms, condition)
  on public.garage_laps to setupsheet_garage_writer;
grant select (session_id, id, created_at, parameter, direction, amount, verdict)
  on public.garage_run_plan_items to setupsheet_garage_writer;

create policy "Garage writer can read laps through owned sessions"
  on public.garage_laps for select to setupsheet_garage_writer
  using (
    exists (
      select 1 from public.garage_sessions s
      where s.id = garage_laps.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Garage writer can read run-plan items through owned sessions"
  on public.garage_run_plan_items for select to setupsheet_garage_writer
  using (
    exists (
      select 1 from public.garage_sessions s
      where s.id = garage_run_plan_items.session_id
        and s.user_id = auth.uid()
    )
  );

create or replace function public.create_field_test_report(
  p_garage_session_id uuid,
  p_setup_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_setup_id uuid;
  v_game text;
  v_condition text;
  v_laps_run integer;
  v_best_lap_ms integer;
  v_average_lap_ms numeric;
  v_stddev_lap_ms numeric;
  v_consistency_pct numeric(4, 1);
  v_validated_changes jsonb;
  v_report_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_note is null or char_length(p_note) > 1000 then
    raise exception 'Field-test note is invalid' using errcode = '22023';
  end if;

  select s.source_setup_id, s.game
    into v_source_setup_id, v_game
    from public.garage_sessions s
    where s.id = p_garage_session_id
      and s.user_id = v_user_id;

  if not found then
    raise exception 'Garage session not found' using errcode = 'P0002';
  end if;
  if v_source_setup_id is distinct from p_setup_id then
    raise exception 'Garage session was not started from this setup' using errcode = '22023';
  end if;

  select
    count(l.lap_time_ms)::integer,
    min(l.lap_time_ms),
    avg(l.lap_time_ms)::numeric,
    stddev_samp(l.lap_time_ms)::numeric
  into v_laps_run, v_best_lap_ms, v_average_lap_ms, v_stddev_lap_ms
  from public.garage_laps l
  where l.session_id = p_garage_session_id;

  if v_laps_run < 1 then
    raise exception 'Log at least one lap before submitting a field test' using errcode = '22023';
  end if;

  select case
    when bool_or(l.condition = 'Mixed') or count(distinct l.condition) > 1 then 'Mixed'
    else min(l.condition)
  end
  into v_condition
  from public.garage_laps l
  where l.session_id = p_garage_session_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'parameter', item.parameter,
        'direction', item.direction,
        'amount', item.amount
      ) order by item.created_at, item.id
    ),
    '[]'::jsonb
  )
  into v_validated_changes
  from public.garage_run_plan_items item
  where item.session_id = p_garage_session_id
    and item.verdict = 'better';

  if jsonb_array_length(v_validated_changes) < 1 then
    raise exception 'Record at least one better run-plan result before submitting a field test' using errcode = '22023';
  end if;

  if v_laps_run >= 2 then
    v_consistency_pct := round(
      greatest(
        0::numeric,
        least(100::numeric, 100::numeric * (1 - v_stddev_lap_ms / v_average_lap_ms))
      ),
      1
    );
  else
    v_consistency_pct := null;
  end if;

  insert into public.field_test_reports (
    user_id, garage_session_id, setup_id, game, condition,
    validated_changes, laps_run, consistency_pct, best_lap_ms, note
  ) values (
    v_user_id, p_garage_session_id, p_setup_id, v_game, v_condition,
    v_validated_changes, v_laps_run, v_consistency_pct, v_best_lap_ms, btrim(p_note)
  )
  returning id into v_report_id;

  return v_report_id;
end;
$$;

alter function public.create_field_test_report(uuid, uuid, text)
  owner to setupsheet_garage_writer;
revoke all on function public.create_field_test_report(uuid, uuid, text)
  from public, anon;
grant execute on function public.create_field_test_report(uuid, uuid, text)
  to authenticated;

create or replace function public.set_field_test_report_attribution(
  p_report_id uuid,
  p_show_name boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_setup_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_show_name is null then
    raise exception 'Choose a valid attribution preference' using errcode = '22023';
  end if;

  if p_show_name then
    select coalesce(nullif(left(btrim(profile.username), 80), ''), 'Racer')
      into v_display_name
      from public.profiles profile
      where profile.id = v_user_id;
    if not found then
      v_display_name := 'Racer';
    end if;
  end if;

  update public.field_test_reports
    set show_name = p_show_name,
        display_name_snapshot = v_display_name
    where id = p_report_id
      and user_id = v_user_id
  returning setup_id into v_setup_id;

  if not found then
    raise exception 'Field-test report not found' using errcode = 'P0002';
  end if;
  return v_setup_id;
end;
$$;

alter function public.set_field_test_report_attribution(uuid, boolean)
  owner to setupsheet_garage_writer;
revoke all on function public.set_field_test_report_attribution(uuid, boolean)
  from public, anon;
grant execute on function public.set_field_test_report_attribution(uuid, boolean)
  to authenticated;

-- Public APIs see only the approved projection. The private note, user ID,
-- Garage session ID, and attribution toggle remain absent from these views.
create view public.field_test_reports_public
with (security_barrier = true)
as
select
  report.id as report_id,
  report.setup_id,
  report.game,
  report.condition,
  report.validated_changes,
  report.laps_run,
  report.consistency_pct,
  report.best_lap_ms,
  report.created_at,
  case when report.show_name then report.display_name_snapshot else null end as display_name
from public.field_test_reports report;

grant select on public.field_test_reports_public to anon, authenticated;

create view public.field_test_counts
with (security_barrier = true)
as
select setup_id, count(*)::integer as report_count
from public.field_test_reports
group by setup_id;

grant select on public.field_test_counts to anon, authenticated;

-- The setup owner receives a private notification. Carry the report ID so the
-- notification reader can resolve only the public attribution projection;
-- anonymous reports never leak their reporter ID or profile name to the UI.
alter table public.notifications
  add column field_test_report_id uuid references public.field_test_reports (id) on delete cascade;
create unique index notifications_field_test_report_unique_idx
  on public.notifications (field_test_report_id)
  where field_test_report_id is not null;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('new_setup', 'request_fulfilled', 'new_comment', 'field_test'));

create or replace function public.notify_setup_owner_of_field_test()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setup_owner_id uuid;
begin
  select s.user_id into v_setup_owner_id
    from public.setups s
    where s.id = new.setup_id;

  if v_setup_owner_id is not null and v_setup_owner_id <> new.user_id then
    insert into public.notifications (user_id, actor_id, setup_id, field_test_report_id, type)
    values (v_setup_owner_id, new.user_id, new.setup_id, new.id, 'field_test');
  end if;
  return new;
end;
$$;

create trigger field_test_reports_notify_setup_owner
  after insert on public.field_test_reports
  for each row execute function public.notify_setup_owner_of_field_test();

commit;
