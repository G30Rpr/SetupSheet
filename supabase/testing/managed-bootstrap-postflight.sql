-- Run by test-managed-bootstrap.sh under the non-superuser object creator.
begin;
select current_user as managed_operator \gset
do $$ begin
 if (select rolsuper from pg_roles where rolname=current_user) then
  raise exception 'Regression test must run without SUPERUSER';
 end if;
 if not exists(select 1 from pg_roles where rolname='setupsheet_garage_writer'
 and not (rolcanlogin or rolinherit or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls))
 or has_schema_privilege('setupsheet_garage_writer','public','CREATE')
 or pg_has_role(current_user,'setupsheet_garage_writer','USAGE')
 or not pg_has_role(current_user,'setupsheet_garage_writer','SET')
 or pg_has_role('anon','setupsheet_garage_writer','MEMBER')
 or pg_has_role('authenticated','setupsheet_garage_writer','MEMBER') then
  raise exception 'Managed writer privilege invariant failed';
 end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) then
  raise exception 'Public table missing RLS';
 end if;
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('create_garage_session_with_baseline','create_garage_session_from_setup_with_baseline')
 and p.proowner='setupsheet_garage_writer'::regrole and p.prosecdef)<>2 then
  raise exception 'Garage function ownership changed';
 end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proowner='setupsheet_garage_writer'::regrole
 and (has_function_privilege('anon',p.oid,'EXECUTE')
 or not has_function_privilege('authenticated',p.oid,'EXECUTE'))) then
  raise exception 'Writer-owned public API execution grants changed';
 end if;
end $$;

-- Only the fixture uid helper is replaced, inside this rolled-back test.
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
insert into auth.users(id,email) values
 ('92000000-0000-4000-8000-000000000001','managed-a@test.local'),
 ('92000000-0000-4000-8000-000000000002','managed-b@test.local');

set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
select public.create_garage_session_with_baseline(
 'Assetto Corsa Competizione','Test car','Test track','Dry','Gamepad','{}'::jsonb,'Managed fixture'
) as session_a \gset
do $$ begin
 if (select count(*) from public.garage_sessions)<>1
 or (select count(*) from public.garage_revisions)<>1 then
  raise exception 'Owner session/baseline creation failed';
 end if;
end $$;

select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.garage_sessions) or exists(select 1 from public.garage_revisions) then
  raise exception 'Cross-user Garage data became visible';
 end if;
end $$;
select public.create_garage_session_with_baseline(
 'Le Mans Ultimate','Second car','Second track','Wet',null,'{}'::jsonb,'Second owner'
);
do $$ begin
 if (select count(*) from public.garage_sessions where user_id=auth.uid())<>1 then
  raise exception 'Second owner creation or attribution failed';
 end if;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if has_function_privilege('anon','public.create_garage_session_with_baseline(text,text,text,text,text,jsonb,text)','EXECUTE') then
  raise exception 'Anonymous Garage execution grant survived';
 end if;
 begin
  perform public.create_garage_session_with_baseline('Le Mans Ultimate','Test','Test','Dry',null,'{}'::jsonb,'denied');
  raise exception 'Anonymous Garage creation succeeded';
 exception when insufficient_privilege then null;
 end;
end $$;
set local role :"managed_operator";
do $$ begin
 if (select rolsuper from pg_roles where rolname=current_user) then
  raise exception 'Test accidentally restored a superuser';
 end if;
end $$;
rollback;
