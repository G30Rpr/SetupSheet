-- Disposable PostgreSQL only. Existing garage_rls/rating_trust suites exercise
-- ownership, cross-user writes, private reports and self-rating independently.
begin;
create temporary table rls_before as
select * from pg_catalog.pg_policies where schemaname = 'public';

-- Reapplying the migration must leave every policy attribute unchanged.
\ir ../migrations/20261120150619_rls_identity_initplans.sql
do $$
begin
  if exists ((select * from pg_catalog.pg_policies where schemaname = 'public'
              except select * from rls_before)
             union all
             (select * from rls_before except
              select * from pg_catalog.pg_policies where schemaname = 'public')) then
    raise exception 'REGRESSION: migration reapplication changed policies';
  end if;
end $$;

-- Deliberately place a legacy policy before a drifted one in manifest order.
-- If preflight fails late, the earlier optimization must roll back too.
alter policy "Garage writer can create own field-test reports"
on public.field_test_reports with check (user_id = auth.uid());
alter policy "Users can upvote as themselves"
on public.setup_upvotes with check (true);
savepoint drift_probe;
\set ON_ERROR_STOP off
\ir ../migrations/20261120150619_rls_identity_initplans.sql
\set drift_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
rollback to savepoint drift_probe;
select :'drift_sqlstate' = 'P0001' as drift_rejected \gset
\if :drift_rejected
\else
  do $$ begin raise exception 'REGRESSION: policy drift did not abort'; end $$;
\endif
do $$
begin
  if (select with_check from pg_policies where schemaname = 'public'
      and tablename = 'field_test_reports'
      and policyname = 'Garage writer can create own field-test reports')
      <> '(user_id = auth.uid())' then
    raise exception 'REGRESSION: drift failure left a partial optimization';
  end if;
end $$;
rollback;

-- A request-sensitive STABLE uid() proves identity is evaluated at execution,
-- not frozen when a prepared statement was planned for a previous user.
begin;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;
insert into auth.users(id, email) values
 ('61000000-0000-4000-8000-000000000001', 'initplan-a@test.local'),
 ('61000000-0000-4000-8000-000000000002', 'initplan-b@test.local');
insert into public.garage_sessions(user_id, game, car, track, condition)
select '61000000-0000-4000-8000-000000000001',
 'Assetto Corsa Competizione', 'Test car', 'Test track', 'Dry'
from generate_series(1, 1200);
insert into public.garage_sessions(user_id, game, car, track, condition)
select '61000000-0000-4000-8000-000000000002',
 'Assetto Corsa Competizione', 'Test car', 'Test track', 'Dry'
from generate_series(1, 300);
analyze public.garage_sessions;
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001', true);
do $$
declare plan jsonb;
begin
  if (select count(*) from public.garage_sessions) <> 1200 then
    raise exception 'REGRESSION: owner session visibility changed';
  end if;
  execute 'explain (analyze, format json) select count(*) from public.garage_sessions'
    into plan;
  if not jsonb_path_exists(plan, '$.** ? (@."Parent Relationship" == "InitPlan" && @."Actual Loops" == 1)') then
    raise exception 'REGRESSION: identity has no once-per-statement InitPlan: %', plan;
  end if;
end $$;
prepare rls_identity_visibility as select count(*) from public.garage_sessions;
execute rls_identity_visibility \gset first_
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000002', true);
execute rls_identity_visibility \gset second_
select set_config('request.jwt.claim.sub','', true);
execute rls_identity_visibility \gset missing_
select :first_count = 1200 and :second_count = 300 and :missing_count = 0 as identity_isolated \gset
\if :identity_isolated
\else
  do $$ begin raise exception 'REGRESSION: prepared query leaked rows across identities'; end $$;
\endif
deallocate rls_identity_visibility;
reset role;
rollback;
