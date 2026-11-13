-- Read-only comparison evidence. Run with psql -XAtq -v ON_ERROR_STOP=1 -f ...
-- Save privately; no customer records or credentials are selected.
begin isolation level repeatable read read only;
select jsonb_build_object('kind','server','version',current_setting('server_version'));
select format('select jsonb_build_object(''kind'',''count'',''relation'',%L,''rows'',count(*)) from %I.%I;',
              n.nspname||'.'||c.relname,n.nspname,c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and (n.nspname='public' or (n.nspname,c.relname) in
  (('auth','users'),('auth','identities'),('storage','objects'),('storage','buckets'),('supabase_migrations','schema_migrations')))
order by n.nspname,c.relname
\gexec
select jsonb_build_object('kind','rls','schema',n.nspname,'table',c.relname,
                         'enabled',c.relrowsecurity,'forced',c.relforcerowsecurity)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and n.nspname in ('public','app_private') order by n.nspname,c.relname;
select jsonb_build_object('kind','policy','definition',to_jsonb(p)) from pg_policies p
where schemaname in ('public','app_private','auth','storage') order by schemaname,tablename,policyname;
select jsonb_build_object('kind','constraint','table',conrelid::regclass::text,'name',conname,
                         'validated',convalidated,'definition',pg_get_constraintdef(oid))
from pg_constraint where connamespace='public'::regnamespace order by conrelid::regclass::text,conname;
select jsonb_build_object('kind','function','signature',p.oid::regprocedure::text,
                         'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl,
                         'anon_execute',has_function_privilege('anon',p.oid,'execute'),
                         'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute'))
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','app_private') order by p.oid::regprocedure::text;
select jsonb_build_object('kind','table_grant','definition',to_jsonb(g)) from information_schema.role_table_grants g
where table_schema in ('public','app_private') order by table_schema,table_name,grantee,privilege_type;
select jsonb_build_object('kind','column_grant','definition',to_jsonb(g)) from information_schema.column_privileges g
where table_schema='public' order by table_name,column_name,grantee,privilege_type;
select jsonb_build_object('kind','view','name',c.oid::regclass::text,'options',c.reloptions,'definition',pg_get_viewdef(c.oid))
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v' order by c.relname;
select jsonb_build_object('kind','trigger','table',c.oid::regclass::text,'definition',pg_get_triggerdef(t.oid))
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname in ('public','auth','storage') order by c.oid::regclass::text,t.tgname;
select jsonb_build_object('kind','extension','name',extname,'version',extversion) from pg_extension order by extname;
select jsonb_build_object('kind','managed_column','schema',table_schema,'table',table_name,'column',column_name,
                         'type',udt_name,'nullable',is_nullable,'default',column_default)
from information_schema.columns where table_schema in ('auth','storage') order by table_schema,table_name,ordinal_position;
select jsonb_build_object('kind','bucket','id',id,'public',public,'limit',file_size_limit,'mime_types',allowed_mime_types)
from storage.buckets order by id;
select format('select jsonb_build_object(''kind'',''migration'',''version'',version,''name'',name) from %I.%I order by version;',n.nspname,c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='supabase_migrations' and c.relname='schema_migrations'
\gexec
commit;
