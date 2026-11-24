-- Cache statement-independent auth.uid() calls in the 17 policies still
-- reported by the hosted performance advisor. Preserve roles, commands,
-- permissiveness, ownership correlations and INSERT/UPDATE checks.
--
-- Deliberately explicit manifest: accept only the reviewed old definition or
-- its already-optimized equivalent. Unexpected drift aborts the entire DO
-- statement rather than replacing an operator's authorization decision.
-- No grants, RLS bypass, data changes, or new SECURITY DEFINER functions.
do $migration$
declare
  expected record;
  actual record;
  statement text;
  previous_search_path text := pg_catalog.current_setting('search_path');
  previous_lock_timeout text := pg_catalog.current_setting('lock_timeout');
begin
  -- Deterministic catalog deparsing, independent of the caller's search_path.
  perform pg_catalog.set_config('search_path', 'pg_catalog', true);
  perform pg_catalog.set_config('lock_timeout', '5s', true);
  for expected in
    select * from (values
      ('field_test_reports', 'Garage writer can create own field-test reports', 'INSERT', '{setupsheet_garage_writer}', NULL, '(user_id = auth.uid())', NULL, '(user_id = ( SELECT auth.uid() AS uid))'),
      ('field_test_reports', 'Garage writer can read own field-test reports', 'SELECT', '{setupsheet_garage_writer}', '(user_id = auth.uid())', NULL, '(user_id = ( SELECT auth.uid() AS uid))', NULL),
      ('field_test_reports', 'Garage writer can update own field-test attribution', 'UPDATE', '{setupsheet_garage_writer}', '(user_id = auth.uid())', '(user_id = auth.uid())', '(user_id = ( SELECT auth.uid() AS uid))', '(user_id = ( SELECT auth.uid() AS uid))'),
      ('garage_laps', 'Garage writer can read laps through owned sessions', 'SELECT', '{setupsheet_garage_writer}', '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_laps.session_id) AND (s.user_id = auth.uid()))))', NULL, '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_laps.session_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))', NULL),
      ('garage_laps', 'Users can create laps through their own session', 'INSERT', '{authenticated}', NULL, '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_laps.session_id) AND (s.user_id = auth.uid()))))', NULL, '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_laps.session_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))'),
      ('garage_laps', 'Users can read laps through their own session', 'SELECT', '{authenticated}', '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_laps.session_id) AND (s.user_id = auth.uid()))))', NULL, '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_laps.session_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))', NULL),
      ('garage_revisions', 'Users and garage writer can create revisions through owned sess', 'INSERT', '{authenticated,setupsheet_garage_writer}', NULL, '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_revisions.session_id) AND (s.user_id = auth.uid()))))', NULL, '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_revisions.session_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))'),
      ('garage_revisions', 'Users and garage writer can read revisions through owned sessio', 'SELECT', '{authenticated,setupsheet_garage_writer}', '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_revisions.session_id) AND (s.user_id = auth.uid()))))', NULL, '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_revisions.session_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))', NULL),
      ('garage_run_plan_items', 'Garage writer can read run-plan items through owned sessions', 'SELECT', '{setupsheet_garage_writer}', '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_run_plan_items.session_id) AND (s.user_id = auth.uid()))))', NULL, '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_run_plan_items.session_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))', NULL),
      ('garage_run_plan_items', 'Users can create run-plan items through their own session', 'INSERT', '{authenticated}', NULL, '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_run_plan_items.session_id) AND (s.user_id = auth.uid()))))', NULL, '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_run_plan_items.session_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))'),
      ('garage_run_plan_items', 'Users can read run-plan items through their own session', 'SELECT', '{authenticated}', '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_run_plan_items.session_id) AND (s.user_id = auth.uid()))))', NULL, '(EXISTS ( SELECT 1
   FROM public.garage_sessions s
  WHERE ((s.id = garage_run_plan_items.session_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))', NULL),
      ('garage_sessions', 'Garage writer can create owned sessions', 'INSERT', '{setupsheet_garage_writer}', NULL, '(user_id = auth.uid())', NULL, '(user_id = ( SELECT auth.uid() AS uid))'),
      ('garage_sessions', 'Users and garage writer can read their own sessions', 'SELECT', '{authenticated,setupsheet_garage_writer}', '(user_id = auth.uid())', NULL, '(user_id = ( SELECT auth.uid() AS uid))', NULL),
      ('garage_sessions', 'Users can delete their own garage sessions', 'DELETE', '{authenticated}', '(user_id = auth.uid())', NULL, '(user_id = ( SELECT auth.uid() AS uid))', NULL),
      ('setup_ratings', 'Users can rate as themselves', 'INSERT', '{authenticated}', NULL, '((auth.uid() = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM public.setups s
  WHERE ((s.id = setup_ratings.setup_id) AND (s.user_id = auth.uid()))))))', NULL, '((( SELECT auth.uid() AS uid) = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM public.setups s
  WHERE ((s.id = setup_ratings.setup_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))))'),
      ('setup_ratings', 'Users can update their own rating', 'UPDATE', '{authenticated}', '(auth.uid() = user_id)', '((auth.uid() = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM public.setups s
  WHERE ((s.id = setup_ratings.setup_id) AND (s.user_id = auth.uid()))))))', '(( SELECT auth.uid() AS uid) = user_id)', '((( SELECT auth.uid() AS uid) = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM public.setups s
  WHERE ((s.id = setup_ratings.setup_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))))'),
      ('setup_upvotes', 'Users can upvote as themselves', 'INSERT', '{authenticated}', NULL, '((auth.uid() = user_id) AND (auth.uid() <> ( SELECT s.user_id
   FROM public.setups s
  WHERE (s.id = setup_upvotes.setup_id))))', NULL, '((( SELECT auth.uid() AS uid) = user_id) AND (( SELECT auth.uid() AS uid) <> ( SELECT s.user_id
   FROM public.setups s
  WHERE (s.id = setup_upvotes.setup_id))))')
    ) as manifest(table_name, policy_name, command, role_names,
                  old_using, old_check, new_using, new_check)
  loop
    select * into actual from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = expected.table_name
      and policyname = expected.policy_name;
    if not found then
      raise exception 'RLS initplan preflight: missing policy %.%',
        expected.table_name, expected.policy_name;
    end if;
    if actual.permissive <> 'PERMISSIVE'
       or actual.cmd <> expected.command
       or actual.roles::text <> expected.role_names
       or not (
         (actual.qual is not distinct from expected.old_using
          and actual.with_check is not distinct from expected.old_check)
         or
         (actual.qual is not distinct from expected.new_using
          and actual.with_check is not distinct from expected.new_check)
       ) then
      raise exception 'RLS initplan preflight: unexpected policy drift %.%',
        expected.table_name, expected.policy_name;
    end if;
    if actual.qual is not distinct from expected.new_using
       and actual.with_check is not distinct from expected.new_check then
      continue;
    end if;
    statement := pg_catalog.format('alter policy %I on public.%I',
      expected.policy_name, expected.table_name);
    if expected.new_using is not null then
      statement := statement || pg_catalog.format(' using (%s)', expected.new_using);
    end if;
    if expected.new_check is not null then
      statement := statement || pg_catalog.format(' with check (%s)', expected.new_check);
    end if;
    execute statement;
  end loop;
  perform pg_catalog.set_config('search_path', previous_search_path, true);
  perform pg_catalog.set_config('lock_timeout', previous_lock_timeout, true);
end;
$migration$;
