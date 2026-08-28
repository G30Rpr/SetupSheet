-- Close the INSERT-side equivalent of the row-vs-column RLS gap. RLS
-- restricts the row owner, but without column-scoped INSERT grants a direct
-- authenticated PostgREST caller could provide protected counters, timestamps,
-- or fulfillment fields while still satisfying the row policy.

revoke insert on public.setups from authenticated;
grant insert (
  user_id, game, car, track, condition, lap_time, description, tags,
  rig_profile, setup_values, file_path, file_name, video_url,
  telemetry_file_path, telemetry_file_name
) on public.setups to authenticated;

revoke insert on public.setup_requests from authenticated;
grant insert (requester_id, game, car, track, notes)
on public.setup_requests to authenticated;

revoke insert on public.setup_comments from authenticated;
grant insert (setup_id, user_id, body)
on public.setup_comments to authenticated;

revoke insert on public.setup_upvotes from authenticated;
grant insert (user_id, setup_id)
on public.setup_upvotes to authenticated;

revoke insert on public.setup_favorites from authenticated;
grant insert (user_id, setup_id)
on public.setup_favorites to authenticated;

revoke insert on public.follows from authenticated;
grant insert (follower_id, followed_id)
on public.follows to authenticated;

-- An initial rating may set the application-maintained updated_at value on
-- both insert and upsert-update. created_at remains database-owned.
revoke insert on public.setup_ratings from authenticated;
grant insert (user_id, setup_id, pace, predictability, updated_at)
on public.setup_ratings to authenticated;

-- Basic abuse protection for authenticated community contributions. These
-- triggers run for both Server Actions and direct PostgREST inserts. The
-- advisory lock closes the simple concurrent-insert race around the count;
-- service-role/SQL-editor writes with no auth.uid() are intentionally exempt.
create or replace function public.enforce_setup_creation_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select count(*) into v_count
    from public.setups
    where user_id = v_user_id
      and created_at >= now() - interval '1 hour';

  if v_count >= 20 then
    raise exception 'Upload rate limit reached; try again later';
  end if;
  return new;
end;
$$;

create trigger setups_creation_rate_limit
  before insert on public.setups
  for each row execute function public.enforce_setup_creation_rate_limit();

create or replace function public.enforce_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select count(*) into v_count
    from public.setup_comments
    where user_id = v_user_id
      and created_at >= now() - interval '1 hour';

  if v_count >= 60 then
    raise exception 'Comment rate limit reached; try again later';
  end if;
  return new;
end;
$$;

create trigger setup_comments_rate_limit
  before insert on public.setup_comments
  for each row execute function public.enforce_comment_rate_limit();

create or replace function public.enforce_request_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select count(*) into v_count
    from public.setup_requests
    where requester_id = v_user_id
      and created_at >= now() - interval '1 day';

  if v_count >= 10 then
    raise exception 'Request rate limit reached; try again tomorrow';
  end if;
  return new;
end;
$$;

create trigger setup_requests_rate_limit
  before insert on public.setup_requests
  for each row execute function public.enforce_request_rate_limit();
