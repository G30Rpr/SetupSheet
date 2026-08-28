-- Create a setup and its uploader rating atomically. The web action used to
-- perform these as two independent PostgREST requests, which could leave a
-- newly-published setup with a zero/empty aggregate when the rating insert
-- failed. This invoker RPC runs both inserts in one database transaction and
-- relies on the existing RLS and CHECK constraints for authorization/data
-- validation.

create or replace function public.create_setup_with_rating(
  p_game text,
  p_car text,
  p_track text,
  p_condition text,
  p_lap_time text,
  p_description text,
  p_tags text[],
  p_rig_profile text,
  p_setup_values jsonb,
  p_file_path text,
  p_file_name text,
  p_video_url text,
  p_telemetry_file_path text,
  p_telemetry_file_name text,
  p_pace smallint,
  p_predictability smallint
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_setup_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.setups (
    user_id, game, car, track, condition, lap_time, description, tags,
    rig_profile, setup_values, file_path, file_name, video_url,
    telemetry_file_path, telemetry_file_name
  ) values (
    v_user_id, p_game, p_car, p_track, p_condition, p_lap_time, p_description,
    p_tags, p_rig_profile, p_setup_values, p_file_path, p_file_name, p_video_url,
    p_telemetry_file_path, p_telemetry_file_name
  )
  returning id into v_setup_id;

  insert into public.setup_ratings (user_id, setup_id, pace, predictability)
  values (v_user_id, v_setup_id, p_pace, p_predictability);

  return v_setup_id;
end;
$$;

revoke execute on function public.create_setup_with_rating(
  text, text, text, text, text, text, text[], text, jsonb, text, text,
  text, text, text, smallint, smallint
) from public;
grant execute on function public.create_setup_with_rating(
  text, text, text, text, text, text, text[], text, jsonb, text, text,
  text, text, text, smallint, smallint
) to authenticated;
