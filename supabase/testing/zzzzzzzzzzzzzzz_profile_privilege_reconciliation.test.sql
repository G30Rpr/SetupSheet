-- Exercise the forward repair against deliberately drifted ACLs, then roll
-- everything back. Only the disposable database test harness runs this file.
begin;

grant execute on function public.sync_profile_from_auth(uuid,text,jsonb)
  to public, anon, authenticated;
grant update on public.profiles to public, anon, authenticated;
grant update (follower_count) on public.profiles to authenticated;

\ir ../migrations/20261116201045_profile_privilege_reconciliation.sql
-- A second application must preserve the same effective privileges.
\ir ../migrations/20261116201045_profile_privilege_reconciliation.sql

create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4', 'acl-owner@example.test', '{"full_name":"ACL Owner"}'),
  ('e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5', 'acl-other@example.test', '{"full_name":"ACL Other"}');

do $$
begin
  if not exists (select 1 from public.profiles
    where id='e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4' and username='ACL Owner') then
    raise exception 'Auth signup no longer creates its profile';
  end if;
end;
$$;

set local role anon;
do $$
begin
  perform public.sync_profile_from_auth(
    'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4', 'attacker@example.test',
    '{"full_name":"Injected"}'::jsonb);
  raise exception 'Anonymous profile overwrite was accepted';
exception when insufficient_privilege then null;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4', true);
do $$
declare affected integer;
begin
  update public.profiles set username='Edited Owner', avatar_url='https://example.test/avatar.png'
    where id='e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner cannot edit display fields'; end if;

  update public.profiles set username='Cross-user overwrite'
    where id='e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user profile update was accepted'; end if;

  begin
    update public.profiles set follower_count=999
      where id='e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4';
    raise exception 'Owner can edit derived follower count';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.sync_profile_from_auth(
      'e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5', null, '{"full_name":"Injected"}'::jsonb);
    raise exception 'Authenticated profile overwrite was accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

do $$
begin
  if (select username from public.profiles where id='e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4') <> 'Edited Owner'
    or (select username from public.profiles where id='e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5') <> 'ACL Other' then
    raise exception 'Profile authorization test did not preserve expected data';
  end if;
end;
$$;
rollback;
