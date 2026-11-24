-- Reproduce the hosted drift, prove it permits a mismatch, then repair it.
-- All changes are rolled back in the disposable regression database.
begin;
create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

insert into auth.users(id, email) values
  ('f1111111-1111-4111-8111-111111111111', 'claim-owner@example.test'),
  ('f2222222-2222-4222-8222-222222222222', 'claim-other@example.test'),
  ('f3333333-3333-4333-8333-333333333333', 'claim-requester@example.test');
insert into public.setup_requests(id, requester_id, game, car, track, notes) values
  ('a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'f3333333-3333-4333-8333-333333333333',
   'iRacing', 'porsche 992 gt3 cup', 'spa-francorchamps', 'claim fixture'),
  ('a2222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'f1111111-1111-4111-8111-111111111111',
   'iRacing', 'Porsche 992 GT3 Cup', 'Spa-Francorchamps', 'self fixture');
insert into public.setups(id,user_id,game,car,track,condition,description,tags,rig_profile) values
  ('b1111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb','f1111111-1111-4111-8111-111111111111','iRacing',' Porsche 992 GT3 Cup ',' Spa-Francorchamps ','Dry','matching','{}','Gamepad'),
  ('b2222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb','f1111111-1111-4111-8111-111111111111','Gran Turismo 7','Porsche 992 GT3 Cup','Spa-Francorchamps','Dry','wrong game','{}','Gamepad'),
  ('b3333333-bbbb-4bbb-8bbb-bbbbbbbbbbbb','f1111111-1111-4111-8111-111111111111','iRacing','BMW M4 GT3','Spa-Francorchamps','Dry','wrong car','{}','Gamepad'),
  ('b4444444-bbbb-4bbb-8bbb-bbbbbbbbbbbb','f1111111-1111-4111-8111-111111111111','iRacing','Porsche 992 GT3 Cup','Monza','Dry','wrong track','{}','Gamepad'),
  ('b5555555-bbbb-4bbb-8bbb-bbbbbbbbbbbb','f2222222-2222-4222-8222-222222222222','iRacing','Porsche 992 GT3 Cup','Spa-Francorchamps','Dry','foreign owner','{}','Gamepad');

\ir fixtures/legacy_fulfill_setup_request.sql
savepoint legacy_probe;
set local role authenticated;
select set_config('request.jwt.claim.sub','f1111111-1111-4111-8111-111111111111',true);
select public.fulfill_setup_request('a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','b2222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
reset role;
do $$ begin
  if (select fulfilled_setup_id from public.setup_requests where id='a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      is distinct from 'b2222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid then
    raise exception 'Legacy fixture did not reproduce the missing match check';
  end if;
end $$;
rollback to legacy_probe;

-- Repeated forward application must work even if the older version is marked
-- applied. Explicitly restore an unsafe function grant to exercise ACL repair.
grant execute on function public.fulfill_setup_request(uuid,uuid) to public, anon;
\ir ../migrations/20261116205537_reconcile_request_fulfillment.sql
\ir ../migrations/20261116205537_reconcile_request_fulfillment.sql

set local role anon;
do $$ begin
  perform public.fulfill_setup_request('a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','b1111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  raise exception 'Anonymous fulfillment was accepted';
exception when insufficient_privilege then null;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  perform public.fulfill_setup_request('a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','b1111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  raise exception 'Missing identity was accepted';
exception when insufficient_privilege then null;
end $$;
select set_config('request.jwt.claim.sub','f1111111-1111-4111-8111-111111111111',true);
do $$
declare candidate uuid;
begin
  foreach candidate in array array[
    'b2222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    'b3333333-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    'b4444444-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
  ] loop
    begin
      perform public.fulfill_setup_request('a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',candidate);
      raise exception 'REGRESSION: mismatched setup was accepted';
    exception when raise_exception then
      if sqlerrm <> 'That setup does not match the request''s game, car, and track' then raise; end if;
    end;
  end loop;
  begin
    perform public.fulfill_setup_request('a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','b5555555-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'REGRESSION: foreign setup was accepted';
  exception when raise_exception then
    if sqlerrm <> 'You can only fulfill a request with a setup you own' then raise; end if;
  end;
end $$;

-- Case/whitespace normalization is preserved, along with self-notification exclusion.
select public.fulfill_setup_request('a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','b1111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select public.fulfill_setup_request('a2222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa','b1111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
do $$ begin
  perform public.fulfill_setup_request('a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','b1111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  raise exception 'REGRESSION: duplicate fulfillment was accepted';
exception when raise_exception then
  if sqlerrm <> 'This request has already been fulfilled' then raise; end if;
end $$;
reset role;

do $$ begin
  if (select count(*) from public.setup_requests where id in
      ('a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      and fulfilled_setup_id='b1111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and fulfilled_by='f1111111-1111-4111-8111-111111111111' and fulfilled_at is not null) <> 2 then
    raise exception 'Successful claims did not record the expected fulfillment';
  end if;
  if (select count(*) from public.notifications where actor_id='f1111111-1111-4111-8111-111111111111'
      and type='request_fulfilled' and user_id='f3333333-3333-4333-8333-333333333333') <> 1 then
    raise exception 'Requester did not receive exactly one notification';
  end if;
  if exists(select 1 from public.notifications where actor_id='f1111111-1111-4111-8111-111111111111'
      and type='request_fulfilled' and user_id=actor_id) then
    raise exception 'Self-fulfillment created a notification';
  end if;
end $$;
rollback;
