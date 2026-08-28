-- Defense-in-depth validation for writes made outside the web form.
-- Server Actions validate these values too, but Supabase's REST endpoint is
-- public by design and a caller can bypass the React form entirely. CHECK
-- constraints are added NOT VALID so existing installations with historical
-- rows are not blocked during deployment; PostgreSQL still enforces them for
-- every new row and every subsequent update.

-- Keep profile creation resilient even when an OAuth provider omits a name or
-- sends an unusable avatar URL. The original trigger coalesced only NULL, so
-- an empty provider name could violate the new username constraint and block
-- sign-in entirely.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_username text;
  v_avatar_url text;
begin
  v_username := left(
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'user_name'), ''),
      nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
      'Racer'
    ),
    80
  );
  v_avatar_url := new.raw_user_meta_data ->> 'avatar_url';

  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(nullif(v_username, ''), 'Racer'),
    case when v_avatar_url ~* '^https://' then left(v_avatar_url, 2048) else null end
  );
  return new;
end;
$$;

-- Keep JSONB tuning data to the string map the UI and exporters understand.
create or replace function public.is_valid_setup_values(p_values jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  item record;
  item_count integer := 0;
begin
  if p_values is null then
    return true;
  end if;

  if jsonb_typeof(p_values) <> 'object' then
    return false;
  end if;

  for item in select entry.key, entry.value from jsonb_each(p_values) as entry loop
    item_count := item_count + 1;
    if item_count > 100
       or char_length(item.key) = 0
       or char_length(item.key) > 100
       or jsonb_typeof(item.value) <> 'string'
       or char_length(item.value #>> '{}') > 200 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

-- Public profile text is rendered in every author byline and notification.
alter table public.profiles
  add constraint profiles_username_length_check
  check (char_length(btrim(username)) between 1 and 80)
  not valid;

alter table public.profiles
  add constraint profiles_avatar_url_check
  check (
    avatar_url is null
    or (
      char_length(avatar_url) <= 2048
      and avatar_url ~* '^https://'
    )
  )
  not valid;

-- Setup metadata and tuning values are rendered/exported on public pages.
alter table public.setups
  add constraint setups_car_length_check
  check (char_length(btrim(car)) between 1 and 80)
  not valid;

alter table public.setups
  add constraint setups_track_length_check
  check (char_length(btrim(track)) between 1 and 80)
  not valid;

alter table public.setups
  add constraint setups_lap_time_length_check
  check (lap_time is null or char_length(lap_time) <= 32)
  not valid;

alter table public.setups
  add constraint setups_description_length_check
  check (char_length(description) <= 2000)
  not valid;

alter table public.setups
  add constraint setups_setup_values_shape_check
  check (public.is_valid_setup_values(setup_values))
  not valid;

-- A setup may only reference an object in its own Storage folder. The
-- application creates exactly two path components: <user id>/<object name>.
alter table public.setups
  add constraint setups_file_path_owner_check
  check (
    file_path is null
    or (
      char_length(file_path) <= 512
      and split_part(file_path, '/', 1) = user_id::text
      and array_length(string_to_array(file_path, '/'), 1) = 2
      and split_part(file_path, '/', 2) not in ('.', '..')
      and position(E'\\' in split_part(file_path, '/', 2)) = 0
    )
  )
  not valid;

alter table public.setups
  add constraint setups_file_name_pair_check
  check (
    (file_path is null and file_name is null)
    or (
      file_path is not null
      and file_name is not null
      and char_length(file_name) between 1 and 255
      and position('/' in file_name) = 0
      and position(E'\\' in file_name) = 0
      and file_name ~* '\.(sto|json|ini|svm|sav|txt|xml|csv)$'
    )
  )
  not valid;

alter table public.setups
  add constraint setups_telemetry_path_owner_check
  check (
    telemetry_file_path is null
    or (
      char_length(telemetry_file_path) <= 512
      and split_part(telemetry_file_path, '/', 1) = user_id::text
      and array_length(string_to_array(telemetry_file_path, '/'), 1) = 2
      and split_part(telemetry_file_path, '/', 2) not in ('.', '..')
      and position(E'\\' in split_part(telemetry_file_path, '/', 2)) = 0
    )
  )
  not valid;

alter table public.setups
  add constraint setups_telemetry_name_pair_check
  check (
    (telemetry_file_path is null and telemetry_file_name is null)
    or (
      telemetry_file_path is not null
      and telemetry_file_name is not null
      and char_length(telemetry_file_name) between 1 and 255
      and position('/' in telemetry_file_name) = 0
      and position(E'\\' in telemetry_file_name) = 0
      and telemetry_file_name ~* '\.(ld|ldx|ibt|vbo|drf|csv|zip|zvp|telemetry)$'
    )
  )
  not valid;

-- A proof link is still untrusted user content, so keep it HTTPS and on a
-- provider the UI knows how to render safely. The app performs the same
-- allow-list check before writing, while this closes the direct-REST path.
alter table public.setups
  add constraint setups_video_url_check
  check (
    video_url is null
    or (
      char_length(video_url) <= 2048
      and video_url ~* '^https://(youtube\.com|www\.youtube\.com|m\.youtube\.com|youtu\.be|www\.youtu\.be|twitch\.tv|www\.twitch\.tv|m\.twitch\.tv|clips\.twitch\.tv)([/?#]|$)'
    )
  )
  not valid;

-- Version snapshots contain the same public data and are populated by a
-- trigger, but direct constraints keep a malformed historical blob from
-- reaching the history panel if trigger behavior changes later.
alter table public.setup_versions
  add constraint setup_versions_car_length_check
  check (char_length(btrim(car)) between 1 and 80)
  not valid;

alter table public.setup_versions
  add constraint setup_versions_track_length_check
  check (char_length(btrim(track)) between 1 and 80)
  not valid;

alter table public.setup_versions
  add constraint setup_versions_description_length_check
  check (char_length(description) <= 2000)
  not valid;

alter table public.setup_versions
  add constraint setup_versions_setup_values_shape_check
  check (public.is_valid_setup_values(setup_values))
  not valid;

alter table public.setup_versions
  add constraint setup_versions_file_name_length_check
  check (file_name is null or char_length(file_name) between 1 and 255)
  not valid;

alter table public.setup_versions
  add constraint setup_versions_video_url_check
  check (
    video_url is null
    or (
      char_length(video_url) <= 2048
      and video_url ~* '^https://(youtube\.com|www\.youtube\.com|m\.youtube\.com|youtu\.be|www\.youtu\.be|twitch\.tv|www\.twitch\.tv|m\.twitch\.tv|clips\.twitch\.tv)([/?#]|$)'
    )
  )
  not valid;

alter table public.setup_requests
  add constraint setup_requests_car_length_check
  check (char_length(btrim(car)) between 1 and 80)
  not valid;

alter table public.setup_requests
  add constraint setup_requests_track_length_check
  check (char_length(btrim(track)) between 1 and 80)
  not valid;

alter table public.setup_requests
  add constraint setup_requests_notes_length_check
  check (char_length(notes) <= 2000)
  not valid;

alter table public.setup_comments
  add constraint setup_comments_body_not_blank
  check (char_length(btrim(body)) > 0)
  not valid;

-- Ratings are the other user-owned mutation table. Row RLS scopes the
-- rating to its author, but without column grants the author could move an
-- existing rating to another setup or rewrite its timestamps. Keep only the
-- two rating values and the app-maintained timestamp writable.
revoke update on public.setup_ratings from authenticated;
grant update (pace, predictability, updated_at) on public.setup_ratings to authenticated;

-- Use the positional argument in the public counter helper so a parameter
-- name can never be confused with the `setups.id`/`setup_id` column.
create or replace function public.increment_downloads(setup_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.setups as s
    set downloads = s.downloads + 1
    where s.id = $1;
$$;

-- The fulfillment RPC is an authenticated action, not a public download
-- helper. Remove its default PUBLIC EXECUTE grant so anonymous callers do
-- not get a security-definer entry point at all.
revoke execute on function public.fulfill_setup_request(uuid, uuid) from public;
grant execute on function public.fulfill_setup_request(uuid, uuid) to authenticated;
