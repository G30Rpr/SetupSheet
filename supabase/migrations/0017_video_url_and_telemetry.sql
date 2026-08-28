-- 0017_video_url_and_telemetry.sql
-- Adds support for verified hotlap video URLs (YouTube/Twitch) and telemetry file attachments (.ld, .ibt, etc.)

alter table public.setups add column if not exists video_url text;
alter table public.setups add column if not exists telemetry_file_path text;
alter table public.setups add column if not exists telemetry_file_name text;

alter table public.setup_versions add column if not exists video_url text;
alter table public.setup_versions add column if not exists telemetry_file_path text;
alter table public.setup_versions add column if not exists telemetry_file_name text;

-- Update column-level grants for authenticated users
revoke update on public.setups from authenticated;
grant update (
  game, car, track, condition, lap_time, description,
  tags, rig_profile, setup_values, file_path, file_name,
  video_url, telemetry_file_path, telemetry_file_name
) on public.setups to authenticated;

-- Replace snapshot trigger function to include video_url, telemetry_file_path, telemetry_file_name
create or replace function public.handle_setup_update_snapshot()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (
    old.game is distinct from new.game or
    old.car is distinct from new.car or
    old.track is distinct from new.track or
    old.condition is distinct from new.condition or
    old.lap_time is distinct from new.lap_time or
    old.description is distinct from new.description or
    old.tags is distinct from new.tags or
    old.rig_profile is distinct from new.rig_profile or
    old.setup_values is distinct from new.setup_values or
    old.file_path is distinct from new.file_path or
    old.file_name is distinct from new.file_name or
    old.video_url is distinct from new.video_url or
    old.telemetry_file_path is distinct from new.telemetry_file_path or
    old.telemetry_file_name is distinct from new.telemetry_file_name
  ) then
    insert into public.setup_versions (
      setup_id, edited_by, game, car, track, condition, lap_time,
      description, tags, rig_profile, setup_values, file_path, file_name,
      video_url, telemetry_file_path, telemetry_file_name
    ) values (
      old.id, new.user_id, old.game, old.car, old.track, old.condition, old.lap_time,
      old.description, old.tags, old.rig_profile, old.setup_values, old.file_path, old.file_name,
      old.video_url, old.telemetry_file_path, old.telemetry_file_name
    );
  end if;
  return new;
end;
$$;
