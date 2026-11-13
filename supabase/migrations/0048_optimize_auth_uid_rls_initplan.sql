-- 0048_optimize_auth_uid_rls_initplan.sql
-- SS-AUD-006: Supabase advises that 17 RLS policies recompute auth.uid()
-- on every row. Materialize it as a per-statement initplan via SELECT.
-- Preserve exact existing predicates, roles, and policy command types.
-- Fail closed if a target policy is missing rather than silently skipping it.

do $$
declare
  p record;
  v_using text;
  v_check text;
  v_count integer := 0;
begin
  for p in
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
    select pol.* from pg_catalog.pg_policies pol
    join target t on t.table_name=pol.tablename and t.policy_name=pol.policyname
    where pol.schemaname='public'
  loop
    v_count := v_count + 1;
    v_using := case when p.qual is null then ''
      else format(' USING (%s)',replace(p.qual,'auth.uid()','(select auth.uid())')) end;
    v_check := case when p.with_check is null then ''
      else format(' WITH CHECK (%s)',replace(p.with_check,'auth.uid()','(select auth.uid())')) end;
    execute format('ALTER POLICY %I ON public.%I%s%s',
      p.policyname,p.tablename,v_using,v_check);
  end loop;

  if v_count <> 17 then
    raise exception 'Expected 17 RLS optimization targets, matched %',v_count;
  end if;
end;
$$;
