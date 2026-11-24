-- Actual API roles plus an intentionally drifted ACL, on disposable fixtures.
begin;
-- Inject both a blanket grant and a separate protected-column grant. A table
-- REVOKE alone does not remove the latter.
grant insert,update on public.setup_requests,public.setup_ratings to authenticated;
grant insert(created_at),update(created_at) on public.setup_comments to authenticated;
grant insert,update on public.setup_requests to public;
\ir ../migrations/20261123151059_reconcile_mutation_column_grants.sql
\ir ../migrations/20261123151059_reconcile_mutation_column_grants.sql

do $$
begin
  if has_column_privilege('authenticated','public.setup_requests','fulfilled_at','INSERT')
     or has_column_privilege('authenticated','public.setup_comments','created_at','INSERT')
     or has_column_privilege('authenticated','public.setup_ratings','setup_id','UPDATE')
     or has_column_privilege('anon','public.setup_requests','notes','INSERT') then
    raise exception 'REGRESSION: stale table/column/PUBLIC privileges survived';
  end if;
  if (select prosecdef from pg_proc where oid='public.save_setup_rating(uuid,smallint,smallint,text)'::regprocedure)
     or has_function_privilege('anon','public.save_setup_rating(uuid,smallint,smallint,text)','EXECUTE') then
    raise exception 'REGRESSION: rating helper bypasses RLS or allows anonymous execution';
  end if;
end $$;

insert into auth.users(id,email) values
 ('81000000-0000-4000-8000-000000000001','column-a@test.local'),
 ('81000000-0000-4000-8000-000000000002','column-b@test.local');
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
insert into public.setups(id,user_id,game,car,track,condition,description,tags,rig_profile) values
 ('81000000-0000-4000-8000-000000000011','81000000-0000-4000-8000-000000000001','iRacing','Test','Test','Dry','own','{}','Gamepad'),
 ('81000000-0000-4000-8000-000000000012','81000000-0000-4000-8000-000000000002','iRacing','Test','Test','Dry','other','{}','Gamepad'),
 ('81000000-0000-4000-8000-000000000013','81000000-0000-4000-8000-000000000002','iRacing','Test','Test','Dry','other second','{}','Gamepad');
set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);

-- These are ordinary supported writes, with no table-owner privilege.
insert into public.setup_requests(requester_id,game,car,track,notes)
values(auth.uid(),'iRacing','Test','Test','request');
update public.setup_requests set notes='edited' where requester_id=auth.uid();
insert into public.setup_comments(user_id,setup_id,body)
values(auth.uid(),'81000000-0000-4000-8000-000000000012','ordinary comment');
insert into public.setup_upvotes(user_id,setup_id) values(auth.uid(),'81000000-0000-4000-8000-000000000012');
insert into public.setup_favorites(user_id,setup_id) values(auth.uid(),'81000000-0000-4000-8000-000000000012');
insert into public.follows(follower_id,followed_id) values(auth.uid(),'81000000-0000-4000-8000-000000000002');
select public.save_setup_rating('81000000-0000-4000-8000-000000000012',4::smallint,3::smallint,'Gamepad');
select public.save_setup_rating('81000000-0000-4000-8000-000000000012',5::smallint,4::smallint,'Wheel + 3 Pedals');
do $$
declare statement text;
begin
  if (select count(*) from public.setup_ratings where user_id=auth.uid())<>1
     or not exists(select 1 from public.setup_ratings where user_id=auth.uid() and pace=5
                   and rater_rig='Wheel + 3 Pedals' and rater_input_device='wheel' and rater_brake_type='standard') then
    raise exception 'REGRESSION: atomic rating upsert or derived rig axes failed';
  end if;
  foreach statement in array array[
    $q$insert into public.setup_requests(requester_id,game,car,track,notes,fulfilled_setup_id,fulfilled_by,fulfilled_at)
       values(auth.uid(),'iRacing','Test','Test','forged','81000000-0000-4000-8000-000000000012',auth.uid(),now())$q$,
    $q$insert into public.setup_requests(requester_id,game,car,track,notes,created_at)
       values(auth.uid(),'iRacing','Test','Test','backdated','2000-01-01')$q$,
    $q$insert into public.setup_comments(user_id,setup_id,body,created_at)
       values(auth.uid(),'81000000-0000-4000-8000-000000000012','backdated','2000-01-01')$q$,
    $q$update public.setup_ratings set setup_id='81000000-0000-4000-8000-000000000013' where user_id=auth.uid()$q$,
    $q$update public.setup_ratings set created_at='2000-01-01' where user_id=auth.uid()$q$,
    $q$update public.setup_ratings set rater_input_device='direct_drive',rater_brake_type='load_cell' where user_id=auth.uid()$q$
  ] loop
    begin
      execute statement;
      raise exception 'REGRESSION: protected mutation succeeded: %',statement;
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    perform public.save_setup_rating('81000000-0000-4000-8000-000000000011',5::smallint,5::smallint,null);
    raise exception 'REGRESSION: helper allowed self-rating';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_setup_rating('81000000-0000-4000-8000-000000000012',0::smallint,5::smallint,null);
    raise exception 'REGRESSION: helper accepted invalid scores';
  exception when invalid_parameter_value then null; end;
end $$;
-- Owner-scoped DELETE and its aggregate-maintenance triggers still work.
delete from public.setup_upvotes where user_id=auth.uid();
delete from public.setup_favorites where user_id=auth.uid();
delete from public.follows where follower_id=auth.uid();

-- Fulfillment remains a trusted RPC, not writable request INSERT fields.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
select public.fulfill_setup_request(
 (select id from public.setup_requests where requester_id='81000000-0000-4000-8000-000000000001'),
 '81000000-0000-4000-8000-000000000012');
do $$
begin
  if not exists(select 1 from public.setup_requests where fulfilled_by=auth.uid()) then
    raise exception 'REGRESSION: privileged fulfillment no longer works';
  end if;
  if exists(select 1 from public.setup_ratings where user_id='81000000-0000-4000-8000-000000000001') then
    raise exception 'REGRESSION: foreign rating became visible';
  end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$
begin
  begin
    perform public.save_setup_rating('81000000-0000-4000-8000-000000000012',5::smallint,5::smallint,null);
    raise exception 'REGRESSION: missing identity accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;

-- Unreviewed inherited grants cannot be silently ignored. Error at the last
-- table must roll back earlier table repairs too.
begin;
create role setupsheet_grant_drift nologin;
grant setupsheet_grant_drift to authenticated;
grant update(created_at) on public.setup_ratings to setupsheet_grant_drift;
grant insert on public.setup_requests to authenticated;
savepoint inherited_probe;
\set ON_ERROR_STOP off
\ir ../migrations/20261123151059_reconcile_mutation_column_grants.sql
\set inherited_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
rollback to savepoint inherited_probe;
select :'inherited_sqlstate'='P0001' as inherited_rejected \gset
\if :inherited_rejected
\else
 do $$ begin raise exception 'REGRESSION: inherited drift was not rejected'; end $$;
\endif
do $$
begin
  if not has_table_privilege('authenticated','public.setup_requests','INSERT') then
    raise exception 'REGRESSION: late drift failure left a partial ACL repair';
  end if;
end $$;
rollback;

-- PUBLIC revocation must not silently remove a custom service-role capability.
-- This fixture deliberately makes its protected-column INSERT depend on PUBLIC.
begin;
revoke insert on public.setup_requests from service_role;
revoke insert(created_at) on public.setup_requests from service_role;
grant insert(created_at) on public.setup_requests to public;
savepoint service_probe;
\set ON_ERROR_STOP off
\ir ../migrations/20261123151059_reconcile_mutation_column_grants.sql
\set service_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
rollback to savepoint service_probe;
select :'service_sqlstate'='P0001' as service_rejected \gset
\if :service_rejected
\else
 do $$ begin raise exception 'REGRESSION: service privilege loss was not rejected'; end $$;
\endif
do $$
begin
  if not has_column_privilege('service_role','public.setup_requests','created_at','INSERT') then
    raise exception 'REGRESSION: failed repair changed effective service privileges';
  end if;
end $$;
rollback;
