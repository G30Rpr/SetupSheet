-- Restore reviewed client mutation boundaries without changing rows or RLS.
-- Apply transactionally with the matching save_setup_rating application change.
set local lock_timeout = '5s';
-- PostgREST upsert updates every supplied column, including conflict keys.
-- Keep those keys immutable while providing an atomic, RLS-respecting upsert
-- that updates only reviewed fields and derives the caller from auth.uid().
create or replace function public.save_setup_rating(
  p_setup_id uuid, p_pace smallint, p_predictability smallint, p_rater_rig text default null
) returns void language plpgsql security invoker set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_setup_id is null or p_pace is null or p_predictability is null
     or p_pace not between 1 and 5 or p_predictability not between 1 and 5
     or (p_rater_rig is not null and p_rater_rig not in
        ('Gamepad','Wheel + 3 Pedals','Wheel + Handbrake','Direct Drive + Load Cell')) then
    raise exception 'Invalid rating' using errcode='22023';
  end if;
  insert into public.setup_ratings(user_id,setup_id,pace,predictability,rater_rig,updated_at)
  values (caller,p_setup_id,p_pace,p_predictability,p_rater_rig,clock_timestamp())
  on conflict(user_id,setup_id) do update set
    pace=excluded.pace,predictability=excluded.predictability,
    rater_rig=excluded.rater_rig,updated_at=excluded.updated_at;
end $$;
revoke all on function public.save_setup_rating(uuid,smallint,smallint,text) from public,anon;
grant execute on function public.save_setup_rating(uuid,smallint,smallint,text) to authenticated;

do $repair$
declare
  expected record;
  column_names text;
  col record;
  role_name text;
  permission text;
  allowed boolean;
begin
  for expected in select * from (values
    ('setup_requests', array['requester_id','game','car','track','notes'], array['notes']),
    ('setup_comments', array['setup_id','user_id','body'], array[]::text[]),
    ('setup_upvotes', array['user_id','setup_id'], array[]::text[]),
    ('setup_favorites', array['user_id','setup_id'], array[]::text[]),
    ('follows', array['follower_id','followed_id'], array[]::text[]),
    ('setup_ratings', array['user_id','setup_id','pace','predictability','rater_rig','updated_at'],
                      array['pace','predictability','rater_rig','updated_at'])
  ) manifest(table_name, insert_columns, update_columns)
  loop
    if not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
                  where n.nspname='public' and c.relname=expected.table_name and c.relkind='r' and c.relrowsecurity) then
      raise exception 'Column grant preflight: missing/RLS-disabled table %',expected.table_name;
    end if;
    select string_agg(format('%I',attname),', ' order by attnum) into column_names
    from pg_catalog.pg_attribute where attrelid=format('public.%I',expected.table_name)::regclass
      and attnum>0 and not attisdropped;
    -- Table REVOKE does not remove old per-column grants. Remove both layers,
    -- including PUBLIC inheritance, before restoring the explicit allowlists.
    execute format('revoke insert, update on public.%I from public, anon, authenticated',expected.table_name);
    execute format('revoke insert (%s), update (%s) on public.%I from public, anon, authenticated',column_names,column_names,expected.table_name);
    select string_agg(format('%I',c),', ') into column_names from unnest(expected.insert_columns) c;
    execute format('grant insert (%s) on public.%I to authenticated',column_names,expected.table_name);
    if cardinality(expected.update_columns)>0 then
      select string_agg(format('%I',c),', ') into column_names from unnest(expected.update_columns) c;
      execute format('grant update (%s) on public.%I to authenticated',column_names,expected.table_name);
    end if;
    -- Other inherited roles/ownership can defeat direct REVOKEs. Do not report
    -- success unless effective privileges match every reviewed column exactly.
    for col in select attname from pg_catalog.pg_attribute
      where attrelid=format('public.%I',expected.table_name)::regclass and attnum>0 and not attisdropped
    loop
      foreach role_name in array array['anon','authenticated'] loop
        foreach permission in array array['INSERT','UPDATE'] loop
          allowed := role_name='authenticated' and col.attname = any(
            case permission when 'INSERT' then expected.insert_columns else expected.update_columns end);
          if has_column_privilege(role_name,format('public.%I',expected.table_name),col.attname,permission) is distinct from allowed then
            raise exception 'Column grant postflight failed %.% % %',expected.table_name,col.attname,role_name,permission;
          end if;
        end loop;
      end loop;
    end loop;
  end loop;
end $repair$;

