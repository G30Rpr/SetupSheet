-- Test-only reproduction of the older hosted body. Used to prove that the
-- forward migration repairs drift rather than only passing on a fresh schema.
create or replace function public.fulfill_setup_request(request_id uuid, setup_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_requester_id uuid;
  v_already_fulfilled boolean;
  v_setup_owner uuid;
begin
  select requester_id, fulfilled_setup_id is not null
    into v_requester_id, v_already_fulfilled
    from public.setup_requests where id = request_id;
  if v_requester_id is null then raise exception 'Request not found'; end if;
  if v_already_fulfilled then raise exception 'This request has already been fulfilled'; end if;
  select user_id into v_setup_owner from public.setups where id = setup_id;
  if v_setup_owner is null or v_setup_owner <> auth.uid() then
    raise exception 'You can only fulfill a request with a setup you own';
  end if;
  update public.setup_requests
    set fulfilled_setup_id = setup_id, fulfilled_by = auth.uid(), fulfilled_at = now()
    where id = request_id;
  insert into public.notifications(user_id, actor_id, setup_id, type)
    values(v_requester_id, auth.uid(), setup_id, 'request_fulfilled');
end;
$$;
