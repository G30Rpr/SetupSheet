-- SS-AUD-004: public roles cannot invoke internal SECURITY DEFINER helpers.
\set ON_ERROR_STOP on
\echo 'CHECK 1: internal trigger/aggregate routines are not public RPCs'
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.enforce_comment_rate_limit()',
    'public.enforce_request_rate_limit()',
    'public.enforce_setup_creation_rate_limit()',
    'public.handle_setup_request_reopen()',
    'public.notify_setup_owner_of_field_test()',
    'public.prevent_self_rating()',
    'public.rating_weight(uuid,uuid)',
    'public.recompute_setup_rating_for(uuid)',
    'public.touch_saved_rig_profile()'
  ] loop
    if has_function_privilege('anon',fn,'EXECUTE')
      or has_function_privilege('authenticated',fn,'EXECUTE')
    then raise exception 'Exposed privileged/internal helper: %',fn; end if;
  end loop;
  if not has_function_privilege('anon',
      'public.get_setup_rating_splits(uuid[])','EXECUTE')
  then raise exception 'Public rating breakdown API was broken'; end if;
end $$;

\echo 'CHECK 2: API roles cannot truncate tables or define triggers'
do $$
begin
  if has_table_privilege('anon','public.setups','TRUNCATE')
    or has_table_privilege('authenticated','public.profiles','TRIGGER')
    or has_table_privilege('anon','public.setup_ratings','REFERENCES')
  then raise exception 'Privileged public table grants still present'; end if;
  if not has_table_privilege('anon','public.setups','SELECT') then
    raise exception 'Public setup reading was unintentionally revoked'; end if;
end $$;

\echo 'CHECK 3: saved-rig trigger has fixed search_path'
do $$
declare cfg text[];
begin
 select proconfig into cfg from pg_proc
 where oid='public.touch_saved_rig_profile()'::regprocedure;
 if cfg is null or not 'search_path=pg_catalog'=any(cfg)
 then raise exception 'Saved rig trigger function has mutable search_path'; end if;
end $$;
