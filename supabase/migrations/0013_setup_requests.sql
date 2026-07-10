-- Setup requests board: "I need a setup for X car at Y track", fulfillable
-- by anyone who has a matching setup of their own -- not just the
-- requester. See fulfill_setup_request() below for why that needs an RPC
-- rather than a plain UPDATE.

create table public.setup_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,

  game text not null check (game in (
    'iRacing', 'Assetto Corsa EVO', 'Assetto Corsa Competizione', 'Assetto Corsa',
    'Le Mans Ultimate', 'Automobilista 2', 'Gran Turismo 7', 'F1 25'
  )),
  car text not null,
  track text not null,
  notes text not null default '',

  fulfilled_setup_id uuid references public.setups (id) on delete set null,
  fulfilled_by uuid references public.profiles (id) on delete set null,
  fulfilled_at timestamptz,

  created_at timestamptz not null default now()
);

create index setup_requests_open_idx on public.setup_requests (created_at desc)
  where fulfilled_setup_id is null;
create index setup_requests_game_car_track_idx on public.setup_requests (game, car, track)
  where fulfilled_setup_id is null;

alter table public.setup_requests enable row level security;

create policy "Setup requests are viewable by everyone"
  on public.setup_requests for select
  using (true);

create policy "Users can post requests as themselves"
  on public.setup_requests for insert
  to authenticated
  with check (auth.uid() = requester_id);

create policy "Users can edit their own requests"
  on public.setup_requests for update
  to authenticated
  using (auth.uid() = requester_id)
  with check (auth.uid() = requester_id);

create policy "Users can cancel their own requests"
  on public.setup_requests for delete
  to authenticated
  using (auth.uid() = requester_id);

-- Column-level grant, in this same migration rather than a bug-fix follow-up
-- like 0009/0011 had to be for setups/profiles/notifications: the update
-- policy above only scopes *which rows* the requester can touch, not which
-- *columns* -- without this, a requester could set their own
-- fulfilled_setup_id/fulfilled_by directly and fake having their request
-- fulfilled. Only `notes` is meant to be user-editable after posting;
-- fulfillment only ever happens through the SECURITY DEFINER RPC below.
revoke update on public.setup_requests from authenticated;
grant update (notes) on public.setup_requests to authenticated;

-- Fulfilling a request is an action taken by someone *other* than the
-- requester (the person offering a setup), so it can't go through the
-- requester-scoped update policy above. This runs as a SECURITY DEFINER
-- function instead -- same convention as increment_downloads() in
-- 0004_setup_files.sql -- doing its own authorization checks internally
-- rather than relying on RLS.
create function public.fulfill_setup_request(request_id uuid, setup_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_requester_id uuid;
  v_already_fulfilled boolean;
  v_setup_owner uuid;
begin
  select requester_id, fulfilled_setup_id is not null
    into v_requester_id, v_already_fulfilled
    from public.setup_requests
    where id = request_id;

  if v_requester_id is null then
    raise exception 'Request not found';
  end if;

  if v_already_fulfilled then
    raise exception 'This request has already been fulfilled';
  end if;

  select user_id into v_setup_owner from public.setups where id = setup_id;

  if v_setup_owner is null or v_setup_owner <> auth.uid() then
    raise exception 'You can only fulfill a request with a setup you own';
  end if;

  update public.setup_requests
    set fulfilled_setup_id = setup_id, fulfilled_by = auth.uid(), fulfilled_at = now()
    where id = request_id;

  insert into public.notifications (user_id, actor_id, setup_id, type)
    values (v_requester_id, auth.uid(), setup_id, 'request_fulfilled');
end;
$$;

-- Widen notifications.type to allow the new kind emitted above -- 0008
-- named the check constraint implicitly, so this relies on the default
-- Postgres naming (<table>_<column>_check) it produced.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('new_setup', 'request_fulfilled'));
