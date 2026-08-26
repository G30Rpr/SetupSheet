-- Hardens fulfill_setup_request() against three issues found in a follow-up
-- audit of the requests board:
--
-- 1. (Critical) The original function only checked that the caller owned
--    the offered setup -- it never checked that setup's game/car/track
--    matched the request at all. Since this SECURITY DEFINER function is
--    the actual trust boundary (the UI's own picker filtering by game is
--    just a client-side convenience, not enforcement), any authenticated
--    user could loop over every open request and "fulfill" each one with a
--    single unrelated setup they own, polluting the board and the
--    most-wanted signal and spamming every requester with a bogus
--    notification.
-- 2. A TOCTOU race: the original function did a plain select-then-check
--    followed by an unconditional update, so two concurrent calls for the
--    same request could both pass the "not already fulfilled" check before
--    either commits, silently clobbering one fulfillment with the other.
-- 3. Fulfilling your own request notified yourself, unlike the equivalent
--    self-exclusion already applied to comments (0015).
--
-- create or replace keeps the same signature/grants as 0013.
create or replace function public.fulfill_setup_request(request_id uuid, setup_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_requester_id uuid;
  v_request_game text;
  v_request_car text;
  v_request_track text;
  v_setup_owner uuid;
  v_setup_game text;
  v_setup_car text;
  v_setup_track text;
  v_updated_id uuid;
begin
  select requester_id, game, car, track
    into v_requester_id, v_request_game, v_request_car, v_request_track
    from public.setup_requests
    where id = request_id;

  if v_requester_id is null then
    raise exception 'Request not found';
  end if;

  select user_id, game, car, track
    into v_setup_owner, v_setup_game, v_setup_car, v_setup_track
    from public.setups
    where id = setup_id;

  if v_setup_owner is null or v_setup_owner <> auth.uid() then
    raise exception 'You can only fulfill a request with a setup you own';
  end if;

  if v_setup_game is distinct from v_request_game
     or lower(trim(v_setup_car)) is distinct from lower(trim(v_request_car))
     or lower(trim(v_setup_track)) is distinct from lower(trim(v_request_track)) then
    raise exception 'That setup does not match the request''s game, car, and track';
  end if;

  -- Atomic compare-and-swap: only succeeds if still unfulfilled at the
  -- moment of the write, closing the race between two concurrent
  -- fulfillers instead of a separate check-then-update.
  update public.setup_requests
    set fulfilled_setup_id = setup_id, fulfilled_by = auth.uid(), fulfilled_at = now()
    where id = request_id and fulfilled_setup_id is null
    returning id into v_updated_id;

  if v_updated_id is null then
    raise exception 'This request has already been fulfilled';
  end if;

  if v_requester_id <> auth.uid() then
    insert into public.notifications (user_id, actor_id, setup_id, type)
      values (v_requester_id, auth.uid(), setup_id, 'request_fulfilled');
  end if;
end;
$$;

-- Deleting the setup that fulfilled a request only nulls fulfilled_setup_id
-- (via the FK's `on delete set null`), leaving fulfilled_by/fulfilled_at
-- stale -- the request silently "reopens" (isFulfilled derives from
-- fulfilled_setup_id alone) but still carries an old fulfilled_at, which
-- corrupts getAllSetupRequests' sort fallback (`fulfilledAt ?? createdAt`)
-- into ordering it by a meaningless past timestamp instead of its real
-- created_at. Postgres's FK actions run as genuine UPDATEs, so a normal
-- BEFORE UPDATE row trigger fires for them same as any other update.
create function public.handle_setup_request_reopen()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.fulfilled_setup_id is null and old.fulfilled_setup_id is not null then
    new.fulfilled_by := null;
    new.fulfilled_at := null;
  end if;
  return new;
end;
$$;

create trigger setup_requests_reopen_trigger
  before update on public.setup_requests
  for each row execute function public.handle_setup_request_reopen();

-- Defense-in-depth length cap on comment bodies -- enforcement previously
-- only existed at the app layer (validateCommentBody / MAX_COMMENT_LENGTH),
-- so a direct PostgREST call with a valid session could insert an
-- arbitrarily long comment that every visitor to the setup then renders.
alter table public.setup_comments
  add constraint setup_comments_body_length check (char_length(body) <= 1000);
