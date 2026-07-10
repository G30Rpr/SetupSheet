-- Version history: a snapshot of a setup's fields is captured immediately
-- before any edit that actually changes something a viewer would care
-- about (as opposed to the upvote/download counter bumps that already
-- update this same row via the triggers in 0001/0004 -- those must NOT
-- produce a spurious "version").

create table public.setup_versions (
  id uuid primary key default gen_random_uuid(),
  setup_id uuid not null references public.setups (id) on delete cascade,
  edited_by uuid not null references public.profiles (id) on delete cascade,

  game text not null,
  car text not null,
  track text not null,
  condition text not null,
  lap_time text,
  description text not null default '',
  tags text[] not null default '{}'::text[],
  rig_profile text not null,
  setup_values jsonb,
  file_path text,
  file_name text,

  created_at timestamptz not null default now()
);

create index setup_versions_setup_id_idx on public.setup_versions (setup_id, created_at desc);

alter table public.setup_versions enable row level security;

-- Public changelog, same visibility as the setups themselves. There is no
-- insert/update/delete policy for `authenticated` at all -- every row is
-- written exclusively by the trigger below, same reasoning as
-- notifications' fan-out trigger in 0008.
create policy "Setup versions are viewable by everyone"
  on public.setup_versions for select
  using (true);

create function public.handle_setup_update_snapshot()
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
    old.file_name is distinct from new.file_name
  ) then
    insert into public.setup_versions (
      setup_id, edited_by, game, car, track, condition, lap_time,
      description, tags, rig_profile, setup_values, file_path, file_name
    ) values (
      old.id, new.user_id, old.game, old.car, old.track, old.condition, old.lap_time,
      old.description, old.tags, old.rig_profile, old.setup_values, old.file_path, old.file_name
    );
  end if;
  return new;
end;
$$;

create trigger on_setup_update_snapshot
  before update on public.setups
  for each row execute function public.handle_setup_update_snapshot();
