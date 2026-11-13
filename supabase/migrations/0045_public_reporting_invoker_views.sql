-- 0045_public_reporting_invoker_views.sql
-- SS-AUD-002: Public reporting should never read owner-private tables through
-- definer-owned views. Materialize only the explicitly public projection, and
-- expose it via SECURITY INVOKER views. Private base table grants stay intact.
-- This migration preserves the existing view names and column contracts.

-- Public-only immutable projection of field tests. The source contains owner
-- and Garage identifiers that intentionally do not exist in this table.
create table public.field_test_public_snapshots (
  report_id uuid primary key,
  setup_id uuid not null references public.setups(id) on delete cascade,
  game text not null,
  condition text not null,
  validated_changes jsonb not null,
  laps_run integer not null,
  consistency_pct numeric,
  best_lap_ms integer not null,
  created_at timestamptz not null,
  display_name text
);
create index field_test_public_snapshots_setup_time_idx
  on public.field_test_public_snapshots (setup_id, created_at desc, report_id desc);
alter table public.field_test_public_snapshots enable row level security;
revoke all on public.field_test_public_snapshots from PUBLIC, anon, authenticated;
grant select on public.field_test_public_snapshots to anon, authenticated;
create policy "Everyone can read public field test snapshots"
  on public.field_test_public_snapshots for select to anon, authenticated
  using (true);

-- One-way mirror; it never stores author ID, private note, Garage session,
-- or the show_name toggle. Revoking direct EXECUTE prevents RPC callers from
-- invoking this trigger routine outside its trusted DML path.
create function public.mirror_public_field_test_report()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.field_test_public_snapshots where report_id = old.id;
    return old;
  end if;
  insert into public.field_test_public_snapshots (
    report_id, setup_id, game, condition, validated_changes,
    laps_run, consistency_pct, best_lap_ms, created_at, display_name
  ) values (
    new.id, new.setup_id, new.game, new.condition, new.validated_changes,
    new.laps_run, new.consistency_pct, new.best_lap_ms, new.created_at,
    case when new.show_name then new.display_name_snapshot else null end
  ) on conflict (report_id) do update set
    setup_id = excluded.setup_id,
    game = excluded.game,
    condition = excluded.condition,
    validated_changes = excluded.validated_changes,
    laps_run = excluded.laps_run,
    consistency_pct = excluded.consistency_pct,
    best_lap_ms = excluded.best_lap_ms,
    created_at = excluded.created_at,
    display_name = excluded.display_name;
  return new;
end;
$$;
revoke execute on function public.mirror_public_field_test_report()
  from PUBLIC, anon, authenticated;
create trigger mirror_public_field_test_report
  after insert or update or delete on public.field_test_reports
  for each row execute function public.mirror_public_field_test_report();

-- Existing reports are visible through the same opt-in public projection.
insert into public.field_test_public_snapshots (
  report_id, setup_id, game, condition, validated_changes,
  laps_run, consistency_pct, best_lap_ms, created_at, display_name
)
select id, setup_id, game, condition, validated_changes,
  laps_run, consistency_pct, best_lap_ms, created_at,
  case when show_name then display_name_snapshot else null end
from public.field_test_reports;

-- Switch both API views to security-invoker reads of a deliberately public,
-- row-level-secured table instead of the private field_test_reports table.
create or replace view public.field_test_reports_public
with (security_barrier = true, security_invoker = true)
as select report_id, setup_id, game, condition, validated_changes,
          laps_run, consistency_pct, best_lap_ms, created_at, display_name
from public.field_test_public_snapshots;

create or replace view public.field_test_counts
with (security_barrier = true, security_invoker = true)
as select setup_id, count(*)::integer as report_count
from public.field_test_public_snapshots
group by setup_id;

-- Public count-only snapshot of Garage laps, with no session/user identifiers.
create table public.setup_impact_public_totals (
  setup_id uuid primary key references public.setups(id) on delete cascade,
  laps_driven_by_others integer not null default 0
    check (laps_driven_by_others >= 0)
);
alter table public.setup_impact_public_totals enable row level security;
revoke all on public.setup_impact_public_totals from PUBLIC, anon, authenticated;
grant select on public.setup_impact_public_totals to anon, authenticated;
create policy "Everyone can read public impact totals"
  on public.setup_impact_public_totals for select to anon, authenticated
  using (true);

-- Owner-only recomputation from private Garage rows. Recompute (rather than
-- increment/decrement) handles session ownership and source changes safely.
create function public.refresh_public_setup_impact(p_setup_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_setup_id is null then return; end if;
  insert into public.setup_impact_public_totals(setup_id,laps_driven_by_others)
  select s.id, (
    select count(*)::integer
    from public.garage_laps gl
    join public.garage_sessions gs on gs.id = gl.session_id
    where gs.source_setup_id=s.id and gs.user_id<>s.user_id
  ) from public.setups s where s.id=p_setup_id
  on conflict (setup_id) do update
    set laps_driven_by_others=excluded.laps_driven_by_others;
end;
$$;
revoke execute on function public.refresh_public_setup_impact(uuid)
  from PUBLIC, anon, authenticated;

create function public.refresh_impact_after_lap_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_setup_id uuid;
begin
  if tg_op in ('DELETE','UPDATE') then
    select gs.source_setup_id into v_setup_id from public.garage_sessions gs
    where gs.id=old.session_id;
    perform public.refresh_public_setup_impact(v_setup_id);
  end if;
  if tg_op in ('INSERT','UPDATE') then
    select gs.source_setup_id into v_setup_id from public.garage_sessions gs
    where gs.id=new.session_id;
    perform public.refresh_public_setup_impact(v_setup_id);
  end if;
  return null;
end;
$$;
revoke execute on function public.refresh_impact_after_lap_change()
  from PUBLIC, anon, authenticated;
create trigger refresh_public_impact_after_lap_change
  after insert or update or delete on public.garage_laps
  for each row execute function public.refresh_impact_after_lap_change();

create function public.refresh_impact_after_session_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    perform public.refresh_public_setup_impact(old.source_setup_id);
  end if;
  if tg_op in ('INSERT','UPDATE') then
    perform public.refresh_public_setup_impact(new.source_setup_id);
  end if;
  return null;
end;
$$;
revoke execute on function public.refresh_impact_after_session_change()
  from PUBLIC, anon, authenticated;
create trigger refresh_public_impact_after_session_change
  after insert or update or delete on public.garage_sessions
  for each row execute function public.refresh_impact_after_session_change();

-- Backfill all existing setup counts, including zero values.
insert into public.setup_impact_public_totals(setup_id,laps_driven_by_others)
select s.id, (
  select count(*)::integer from public.garage_laps gl
  join public.garage_sessions gs on gs.id=gl.session_id
  where gs.source_setup_id=s.id and gs.user_id<>s.user_id
) from public.setups s;

create or replace view public.setup_impact_counts
with (security_barrier = true, security_invoker = true)
as select s.id as setup_id,
          coalesce(i.laps_driven_by_others,0)::integer as laps_driven_by_others
from public.setups s
left join public.setup_impact_public_totals i on i.setup_id=s.id;
