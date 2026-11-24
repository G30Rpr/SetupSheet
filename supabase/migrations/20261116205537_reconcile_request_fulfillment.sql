-- Forward repair: hosted history can record 0016 while retaining the earlier
-- body. Never replay or edit that historical migration to reconcile the RPC.
create or replace function public.fulfill_setup_request(request_id uuid, setup_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_request record;
  v_setup record;
  v_updated_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Serialize claims and requester edits before reading the matching fields.
  select r.requester_id, r.game, r.car, r.track, r.fulfilled_setup_id into v_request
    from public.setup_requests r where r.id = request_id
    for update;
  if not found then
    raise exception 'Request not found';
  end if;
  if v_request.fulfilled_setup_id is not null then
    raise exception 'This request has already been fulfilled';
  end if;

  -- Keep ownership and matching metadata stable until the claim commits.
  select s.user_id, s.game, s.car, s.track into v_setup
    from public.setups s where s.id = setup_id
    for share;
  if not found or v_setup.user_id is distinct from v_actor then
    raise exception 'You can only fulfill a request with a setup you own';
  end if;
  if v_setup.game is distinct from v_request.game
     or lower(btrim(v_setup.car)) is distinct from lower(btrim(v_request.car))
     or lower(btrim(v_setup.track)) is distinct from lower(btrim(v_request.track)) then
    raise exception 'That setup does not match the request''s game, car, and track';
  end if;

  update public.setup_requests r
    set fulfilled_setup_id = setup_id, fulfilled_by = v_actor, fulfilled_at = now()
    where r.id = request_id and r.fulfilled_setup_id is null
    returning r.id into v_updated_id;
  if v_updated_id is null then
    raise exception 'This request has already been fulfilled';
  end if;

  if v_request.requester_id <> v_actor then
    insert into public.notifications(user_id, actor_id, setup_id, type)
      values(v_request.requester_id, v_actor, setup_id, 'request_fulfilled');
  end if;
end;
$$;

-- This is an intentional authenticated RPC; row ownership is checked above.
revoke execute on function public.fulfill_setup_request(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.fulfill_setup_request(uuid, uuid) to authenticated;
