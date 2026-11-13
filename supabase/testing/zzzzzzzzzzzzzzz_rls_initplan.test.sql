-- SS-AUD-006: optimized policies must still enforce owner access.
\set ON_ERROR_STOP on
\echo 'CHECK 1: 17 targeted RLS policies use initplan-friendly auth identity'
do $$
declare
  n int;
begin
  with target(table_name,policy_name) as (values
    ('field_test_reports','Garage writer can create own field-test reports'),
    ('field_test_reports','Garage writer can read own field-test reports'),
    ('field_test_reports','Garage writer can update own field-test attribution'),
    ('garage_laps','Garage writer can read laps through owned sessions'),
    ('garage_laps','Users can create laps through their own session'),
    ('garage_laps','Users can read laps through their own session'),
    ('garage_revisions','Users and garage writer can create revisions through owned sess'),
    ('garage_revisions','Users and garage writer can read revisions through owned sessio'),
    ('garage_run_plan_items','Garage writer can read run-plan items through owned sessions'),
    ('garage_run_plan_items','Users can create run-plan items through their own session'),
    ('garage_run_plan_items','Users can read run-plan items through their own session'),
    ('garage_sessions','Garage writer can create owned sessions'),
    ('garage_sessions','Users and garage writer can read their own sessions'),
    ('garage_sessions','Users can delete their own garage sessions'),
    ('setup_ratings','Users can rate as themselves'),
    ('setup_ratings','Users can update their own rating'),
    ('setup_upvotes','Users can upvote as themselves')
  )
  select count(*) into n from pg_policies p join target t
  on p.tablename=t.table_name and p.policyname=t.policy_name
  where p.schemaname='public'
    and coalesce(p.qual,'')||coalesce(p.with_check,'')
      ~* 'select[[:space:]]+auth[.]uid[(][)]';
  if n <> 17 then raise exception 'Expected 17 optimized policies, got %',n; end if;
end $$;

\echo 'CHECK 2: authenticated owner policy still rejects cross-user writes'
-- Existing Garage and rating RLS fixtures exercise the full owner tests.
-- Here we also verify that the INSERT owner predicate remains present.
do $$
declare v text;
begin
  select with_check into v from pg_policies
  where schemaname='public' and tablename='setup_ratings'
    and policyname='Users can rate as themselves';
  if v is null or v not ilike '%user_id%' or v not ilike '%auth.uid()%'
  then raise exception 'Rating INSERT authorization predicate missing'; end if;
end $$;
