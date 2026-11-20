-- Reconcile missing CHECK constraints without replaying migration 0018.
-- Existing definitions must match the reviewed canonical expressions. Existing
-- violations abort the entire file; no application rows are edited or deleted.
-- Run the read-only validation preflight and rehearse the batch before release.

create or replace function public.is_valid_setup_values(p_values jsonb)
returns boolean
language plpgsql
immutable
security invoker
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

do $repair$
declare
  expected record;
  existing_oid oid;
  existing_type "char";
  existing_expression text;
  has_violations boolean;
  prior_path text := current_setting('search_path');
  prior_lock_timeout text := current_setting('lock_timeout');
begin
  perform set_config('search_path', 'pg_catalog, public', true);
  perform set_config('lock_timeout', '5s', true);
  for expected in
    select * from jsonb_to_recordset(
      $checks$[
  {
    "table_name": "profiles",
    "name": "profiles_avatar_url_check",
    "expression": "((avatar_url IS NULL) OR ((char_length(avatar_url) <= 2048) AND (avatar_url ~* '^https://'::text)))"
  },
  {
    "table_name": "profiles",
    "name": "profiles_username_length_check",
    "expression": "((char_length(btrim(username)) >= 1) AND (char_length(btrim(username)) <= 80))"
  },
  {
    "table_name": "setup_comments",
    "name": "setup_comments_body_not_blank",
    "expression": "(char_length(btrim(body)) > 0)"
  },
  {
    "table_name": "setup_requests",
    "name": "setup_requests_car_length_check",
    "expression": "((char_length(btrim(car)) >= 1) AND (char_length(btrim(car)) <= 80))"
  },
  {
    "table_name": "setup_requests",
    "name": "setup_requests_notes_length_check",
    "expression": "(char_length(notes) <= 2000)"
  },
  {
    "table_name": "setup_requests",
    "name": "setup_requests_track_length_check",
    "expression": "((char_length(btrim(track)) >= 1) AND (char_length(btrim(track)) <= 80))"
  },
  {
    "table_name": "setup_versions",
    "name": "setup_versions_car_length_check",
    "expression": "((char_length(btrim(car)) >= 1) AND (char_length(btrim(car)) <= 80))"
  },
  {
    "table_name": "setup_versions",
    "name": "setup_versions_description_length_check",
    "expression": "(char_length(description) <= 2000)"
  },
  {
    "table_name": "setup_versions",
    "name": "setup_versions_file_name_length_check",
    "expression": "((file_name IS NULL) OR ((char_length(file_name) >= 1) AND (char_length(file_name) <= 255)))"
  },
  {
    "table_name": "setup_versions",
    "name": "setup_versions_setup_values_shape_check",
    "expression": "is_valid_setup_values(setup_values)"
  },
  {
    "table_name": "setup_versions",
    "name": "setup_versions_track_length_check",
    "expression": "((char_length(btrim(track)) >= 1) AND (char_length(btrim(track)) <= 80))"
  },
  {
    "table_name": "setup_versions",
    "name": "setup_versions_video_url_check",
    "expression": "((video_url IS NULL) OR ((char_length(video_url) <= 2048) AND (video_url ~* '^https://(youtube\\.com|www\\.youtube\\.com|m\\.youtube\\.com|youtu\\.be|www\\.youtu\\.be|twitch\\.tv|www\\.twitch\\.tv|m\\.twitch\\.tv|clips\\.twitch\\.tv)([/?#]|$)'::text)))"
  },
  {
    "table_name": "setups",
    "name": "setups_car_length_check",
    "expression": "((char_length(btrim(car)) >= 1) AND (char_length(btrim(car)) <= 80))"
  },
  {
    "table_name": "setups",
    "name": "setups_description_length_check",
    "expression": "(char_length(description) <= 2000)"
  },
  {
    "table_name": "setups",
    "name": "setups_file_name_pair_check",
    "expression": "(((file_path IS NULL) AND (file_name IS NULL)) OR ((file_path IS NOT NULL) AND (file_name IS NOT NULL) AND ((char_length(file_name) >= 1) AND (char_length(file_name) <= 255)) AND (POSITION(('/'::text) IN (file_name)) = 0) AND (POSITION(('\\'::text) IN (file_name)) = 0) AND (file_name ~* '\\.(sto|json|ini|svm|sav|txt|xml|csv)$'::text)))"
  },
  {
    "table_name": "setups",
    "name": "setups_file_path_owner_check",
    "expression": "((file_path IS NULL) OR ((char_length(file_path) <= 512) AND (split_part(file_path, '/'::text, 1) = (user_id)::text) AND (array_length(string_to_array(file_path, '/'::text), 1) = 2) AND (split_part(file_path, '/'::text, 2) <> ALL (ARRAY['.'::text, '..'::text])) AND (POSITION(('\\'::text) IN (split_part(file_path, '/'::text, 2))) = 0)))"
  },
  {
    "table_name": "setups",
    "name": "setups_lap_time_length_check",
    "expression": "((lap_time IS NULL) OR (char_length(lap_time) <= 32))"
  },
  {
    "table_name": "setups",
    "name": "setups_setup_values_shape_check",
    "expression": "is_valid_setup_values(setup_values)"
  },
  {
    "table_name": "setups",
    "name": "setups_telemetry_name_pair_check",
    "expression": "(((telemetry_file_path IS NULL) AND (telemetry_file_name IS NULL)) OR ((telemetry_file_path IS NOT NULL) AND (telemetry_file_name IS NOT NULL) AND ((char_length(telemetry_file_name) >= 1) AND (char_length(telemetry_file_name) <= 255)) AND (POSITION(('/'::text) IN (telemetry_file_name)) = 0) AND (POSITION(('\\'::text) IN (telemetry_file_name)) = 0) AND (telemetry_file_name ~* '\\.(ld|ldx|ibt|vbo|drf|csv|zip|zvp|telemetry)$'::text)))"
  },
  {
    "table_name": "setups",
    "name": "setups_telemetry_path_owner_check",
    "expression": "((telemetry_file_path IS NULL) OR ((char_length(telemetry_file_path) <= 512) AND (split_part(telemetry_file_path, '/'::text, 1) = (user_id)::text) AND (array_length(string_to_array(telemetry_file_path, '/'::text), 1) = 2) AND (split_part(telemetry_file_path, '/'::text, 2) <> ALL (ARRAY['.'::text, '..'::text])) AND (POSITION(('\\'::text) IN (split_part(telemetry_file_path, '/'::text, 2))) = 0)))"
  },
  {
    "table_name": "setups",
    "name": "setups_track_length_check",
    "expression": "((char_length(btrim(track)) >= 1) AND (char_length(btrim(track)) <= 80))"
  },
  {
    "table_name": "setups",
    "name": "setups_video_url_check",
    "expression": "((video_url IS NULL) OR ((char_length(video_url) <= 2048) AND (video_url ~* '^https://(youtube\\.com|www\\.youtube\\.com|m\\.youtube\\.com|youtu\\.be|www\\.youtu\\.be|twitch\\.tv|www\\.twitch\\.tv|m\\.twitch\\.tv|clips\\.twitch\\.tv)([/?#]|$)'::text)))"
  }
]$checks$::jsonb
    ) as checks(table_name text, name text, expression text)
  loop
    -- Block writers before checking data so preflight/add cannot race a write.
    -- ADD CONSTRAINT subsequently takes its normal ACCESS EXCLUSIVE lock.
    execute format('lock table public.%I in share row exclusive mode', expected.table_name);
    if row_security_active(format('public.%I', expected.table_name)::regclass) then
      raise exception 'RLS filters rows in public.%; use an authorized migration owner', expected.table_name;
    end if;
    select c.oid, c.contype, pg_get_expr(c.conbin, c.conrelid, false)
      into existing_oid, existing_type, existing_expression
      from pg_constraint c
      where c.conrelid = format('public.%I', expected.table_name)::regclass
        and c.conname = expected.name;
    if existing_oid is not null and
       (existing_type <> 'c' or existing_expression is distinct from expected.expression) then
      raise exception 'Definition mismatch for %.%; review the existing constraint before release',
        expected.table_name, expected.name;
    end if;
    execute format('select exists(select 1 from public.%I where (%s) is false)',
      expected.table_name, expected.expression) into has_violations;
    if has_violations then
      raise exception 'Existing rows violate %.%; reconcile data before applying this repair',
        expected.table_name, expected.name using errcode = '23514';
    end if;
    if existing_oid is null then
      execute format('alter table public.%I add constraint %I check (%s) not valid',
        expected.table_name, expected.name, expected.expression);
    end if;
  end loop;
  perform set_config('search_path', prior_path, true);
  perform set_config('lock_timeout', prior_lock_timeout, true);
end;
$repair$;
