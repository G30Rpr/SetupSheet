-- SS-AUD-002: Public API reads only RLS-protected sanitized snapshots.
\set ON_ERROR_STOP on

\echo 'CHECK 1: all public reporting views invoke caller permissions'
do $$
declare v_count int;
begin
  select count(*) into v_count from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='v'
    and c.relname in ('field_test_counts','field_test_reports_public','setup_impact_counts')
    and 'security_invoker=true'=any(c.reloptions);
  if v_count <> 3 then raise exception 'Expected 3 SECURITY INVOKER reporting views, got %',v_count; end if;
  if has_table_privilege('anon','public.field_test_public_snapshots','INSERT')
    or has_table_privilege('anon','public.field_test_public_snapshots','UPDATE')
    or has_table_privilege('anon','public.setup_impact_public_totals','UPDATE')
    or not has_table_privilege('anon','public.field_test_public_snapshots','SELECT')
  then raise exception 'Public snapshot table permissions are incorrect'; end if;
  if has_table_privilege('anon','public.field_test_reports','SELECT')
    or has_table_privilege('anon','public.garage_laps','SELECT')
  then raise exception 'Private Garage/report data grants widened'; end if;
end $$;

begin;
-- Distinct fixtures rolled back, never retained in later test files.
insert into auth.users(id,email) values
  ('77777777-7777-4777-8777-777777777771','audit-author@example.com'),
  ('77777777-7777-4777-8777-777777777772','audit-driver@example.com');

insert into public.setups(id,user_id,game,car,track,condition,description,rig_profile)
values ('77777777-7777-4777-8777-777777777773',
        '77777777-7777-4777-8777-777777777771',
        'Assetto Corsa Competizione','BMW M4 GT3 2021','Spa-Francorchamps','Dry',
        'audit setup','Direct Drive + Load Cell');

insert into public.garage_sessions(id,user_id,source_setup_id,game,car,track,condition)
values ('77777777-7777-4777-8777-777777777774',
        '77777777-7777-4777-8777-777777777772',
        '77777777-7777-4777-8777-777777777773',
        'Assetto Corsa Competizione','BMW M4 GT3 2021','Spa-Francorchamps','Dry');
insert into public.garage_revisions(id,session_id)
values('77777777-7777-4777-8777-777777777775',
       '77777777-7777-4777-8777-777777777774');
insert into public.garage_laps(session_id,revision_id,lap_time_ms,condition)
values ('77777777-7777-4777-8777-777777777774',
        '77777777-7777-4777-8777-777777777775',120000,'Dry'),
       ('77777777-7777-4777-8777-777777777774',
        '77777777-7777-4777-8777-777777777775',119000,'Dry');
insert into public.field_test_reports
(id,user_id,garage_session_id,setup_id,game,condition,validated_changes,
 laps_run,best_lap_ms,show_name,display_name_snapshot)
values('77777777-7777-4777-8777-777777777776',
       '77777777-7777-4777-8777-777777777772',
       '77777777-7777-4777-8777-777777777774',
       '77777777-7777-4777-8777-777777777773',
       'Assetto Corsa Competizione','Dry','["arbs"]'::jsonb,2,119000,
       false,'Hidden Person');

\echo 'CHECK 2: anonymous users see correct aggregates but no opt-out name'
set local role anon;
do $$
declare v_count int; v_laps int; v_name text;
begin
  select report_count into v_count from public.field_test_counts
  where setup_id='77777777-7777-4777-8777-777777777773';
  select laps_driven_by_others into v_laps from public.setup_impact_counts
  where setup_id='77777777-7777-4777-8777-777777777773';
  select display_name into v_name from public.field_test_reports_public
  where report_id='77777777-7777-4777-8777-777777777776';
  if v_count is distinct from 1 or v_laps is distinct from 2 or v_name is not null
  then raise exception 'Public projections wrong: reports %, laps %, name %',v_count,v_laps,v_name; end if;
end $$;
reset role;

\echo 'CHECK 3: attribution updates and deletes refresh public projection'
update public.field_test_reports set show_name=true,display_name_snapshot='Public Driver'
where id='77777777-7777-4777-8777-777777777776';
do $$ begin
  if (select display_name from public.field_test_reports_public
      where report_id='77777777-7777-4777-8777-777777777776') <> 'Public Driver'
  then raise exception 'Public attribution update not mirrored'; end if;
end $$;

delete from public.field_test_reports where id='77777777-7777-4777-8777-777777777776';
delete from public.garage_sessions where id='77777777-7777-4777-8777-777777777774';
do $$
declare v_laps int;
begin
  if exists (select 1 from public.field_test_reports_public
      where report_id='77777777-7777-4777-8777-777777777776')
  then raise exception 'Deleted report remained public'; end if;
  select laps_driven_by_others into v_laps from public.setup_impact_counts
  where setup_id='77777777-7777-4777-8777-777777777773';
  if v_laps is distinct from 0 then raise exception 'Session delete left stale impact %',v_laps; end if;
end $$;
rollback;
