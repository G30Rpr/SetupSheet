-- SS-AUD-003: download telemetry cannot be mutated through anonymous RPC.
\set ON_ERROR_STOP on

\echo 'CHECK 1: only service_role can invoke the counter'
do $$
begin
 if has_function_privilege('anon','public.increment_downloads(uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.increment_downloads(uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.increment_downloads(uuid)','EXECUTE')
 then raise exception 'Download counter grants are unsafe'; end if;
 if has_schema_privilege('anon','app_private','USAGE')
    or has_schema_privilege('authenticated','app_private','USAGE')
 then raise exception 'Private download limiter schema exposed'; end if;
end $$;

begin;
insert into auth.users(id,email)
values ('88888888-8888-4888-8888-888888888881','count-owner@example.com');
insert into public.setups (id,user_id,game,car,track,condition,description,rig_profile)
values ('88888888-8888-4888-8888-888888888882',
        '88888888-8888-4888-8888-888888888881',
        'Assetto Corsa Competizione','BMW M4 GT3 2021','Spa-Francorchamps','Dry',
        'audit counter','Direct Drive + Load Cell');

\echo 'CHECK 2: service_role increments once for an existing setup'
set local role service_role;
select public.increment_downloads('88888888-8888-4888-8888-888888888882');
reset role;
do $$
begin
 if (select downloads from public.setups
     where id='88888888-8888-4888-8888-888888888882') <> 1
 then raise exception 'Counter did not increment'; end if;
end $$;

\echo 'CHECK 3: daily quota bounds repeated increments'
update app_private.setup_download_daily_windows set increment_count=1000
where setup_id='88888888-8888-4888-8888-888888888882';
set local role service_role;
select public.increment_downloads('88888888-8888-4888-8888-888888888882');
reset role;
do $$
begin
 if (select downloads from public.setups
     where id='88888888-8888-4888-8888-888888888882') <> 1
 then raise exception 'Quota bypassed'; end if;
end $$;
rollback;
