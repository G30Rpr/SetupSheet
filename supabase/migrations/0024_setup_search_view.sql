-- Add the public author name to browse search without denormalizing it into
-- setups. The view remains security-invoker so both underlying public RLS
-- policies are enforced for anonymous and authenticated callers.

drop view if exists public.setup_search;

create view public.setup_search
with (security_invoker = true)
as
select
  s.id,
  s.user_id,
  s.game,
  s.car,
  s.track,
  s.condition,
  s.lap_time,
  s.description,
  s.tags,
  s.rig_profile,
  s.setup_values,
  s.file_path,
  s.file_name,
  s.video_url,
  s.telemetry_file_path,
  s.telemetry_file_name,
  s.pace,
  s.predictability,
  s.rating_count,
  s.upvotes,
  s.downloads,
  s.created_at,
  s.updated_at,
  p.username as author_username
from public.setups as s
left join public.profiles as p on p.id = s.user_id;

grant select on public.setup_search to anon, authenticated;

-- The view planner can push the author predicate down to this trigram index.
create index if not exists profiles_username_trgm_idx
  on public.profiles using gin (username gin_trgm_ops);
