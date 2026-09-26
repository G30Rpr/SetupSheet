-- Let an authenticated Garage session start from a public setup without
-- accepting game/car/track/condition metadata from the browser. The dedicated
-- RPC reads those fields from the public setup row under RLS, then creates the
-- session and baseline revision atomically.

begin;

grant select (id, game, car, track, condition) on public.setups
  to setupsheet_garage_writer;
grant insert (user_id, source_setup_id, game, car, track, condition, rig)
  on public.garage_sessions to setupsheet_garage_writer;

create or replace function public.create_garage_session_from_setup_with_baseline(
  p_source_setup_id uuid,
  p_rig text,
  p_setup_values jsonb,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_game text;
  v_car text;
  v_track text;
  v_condition text;
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select s.game, s.car, s.track, s.condition
    into v_game, v_car, v_track, v_condition
    from public.setups s
    where s.id = p_source_setup_id;

  if not found then
    raise exception 'Source setup not found' using errcode = 'P0002';
  end if;
  if v_game not in ('Assetto Corsa Competizione', 'Le Mans Ultimate') then
    raise exception 'This setup game is not supported by Garage' using errcode = '22023';
  end if;

  insert into public.garage_sessions
    (user_id, source_setup_id, game, car, track, condition, rig)
  values
    (v_user_id, p_source_setup_id, v_game, v_car, v_track, v_condition, p_rig)
  returning id into v_session_id;

  insert into public.garage_revisions (session_id, setup_values, note)
  values (v_session_id, coalesce(p_setup_values, '{}'::jsonb), coalesce(p_note, 'Baseline'));

  return v_session_id;
end;
$$;

alter function public.create_garage_session_from_setup_with_baseline(uuid, text, jsonb, text)
  owner to setupsheet_garage_writer;
revoke all on function public.create_garage_session_from_setup_with_baseline(uuid, text, jsonb, text)
  from public, anon;
grant execute on function public.create_garage_session_from_setup_with_baseline(uuid, text, jsonb, text)
  to authenticated;

commit;
