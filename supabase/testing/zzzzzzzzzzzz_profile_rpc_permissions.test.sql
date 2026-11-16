-- SS-AUD-001: no public privileged profile-sync entry point.
-- This test is metadata-only for the negative cases: no production-like user
-- data is modified and auth signup remains covered by the existing test suite.
\echo 'Audit SS-AUD-001: privilege isolation'
do $$
begin
  if has_function_privilege('anon',
      'public.sync_profile_from_auth(uuid,text,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'public.sync_profile_from_auth(uuid,text,jsonb)', 'EXECUTE')
  then
    raise exception 'REGRESSION: profile synchronization RPC callable by untrusted roles';
  end if;

  if has_function_privilege('anon',
      'public.handle_new_user()', 'EXECUTE')
    or has_function_privilege('authenticated',
      'public.handle_new_user()', 'EXECUTE')
  then
    raise exception 'REGRESSION: auth signup trigger function exposed as RPC';
  end if;
end;
$$;

-- The signup trigger must continue to exist and invoke the internal handler.
do $$
begin
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='auth' and c.relname='users'
      and not t.tgisinternal
      and t.tgfoid='public.handle_new_user()'::regprocedure
  ) then
    raise exception 'REGRESSION: internal signup trigger was disconnected';
  end if;
end;
$$;
