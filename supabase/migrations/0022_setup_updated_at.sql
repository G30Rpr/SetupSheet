-- Keep public freshness metadata accurate when an owner edits a setup. The
-- original schema only tracked created_at, which made sitemap lastModified
-- stale forever after the first edit and weakened cache invalidation options.

alter table public.setups
  add column updated_at timestamptz not null default now();

create function public.touch_setup_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Counter/rating trigger updates should not make every page look newly
  -- edited to crawlers. Only fields a contributor can intentionally change
  -- advance the public freshness timestamp.
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
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

create trigger setups_touch_updated_at
  before update on public.setups
  for each row execute function public.touch_setup_updated_at();

-- The browse, sitemap, and profile readers all use deterministic newest-first
-- keyset ordering. These composite indexes keep those bounded reads from
-- sorting the entire setup table as the catalog grows.
create index setups_created_at_id_idx on public.setups (created_at desc, id desc);
create index setups_user_created_at_id_idx on public.setups (user_id, created_at desc, id desc);

-- Browse search uses case-insensitive substring matches. Trigram indexes keep
-- those validated `ilike` predicates from becoming a full table scan as the
-- catalog grows. `pg_trgm` is available in Supabase and the standard
-- postgres image used by the migration CI job.
create extension if not exists pg_trgm;
create index setups_game_trgm_idx on public.setups using gin (game gin_trgm_ops);
create index setups_car_trgm_idx on public.setups using gin (car gin_trgm_ops);
create index setups_track_trgm_idx on public.setups using gin (track gin_trgm_ops);
create index setups_description_trgm_idx on public.setups using gin (description gin_trgm_ops);
