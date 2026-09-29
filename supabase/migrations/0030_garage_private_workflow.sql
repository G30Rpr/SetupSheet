-- Private Garage workflow: sessions, immutable revision snapshots, planned
-- changes with a verdict, and laps. Run-plan items and laps stay relational so
-- future field-test summaries can be derived from real owned records.

-- Session creation must include its baseline in one transaction. This no-login,
-- non-bypass role owns only that narrow SECURITY DEFINER RPC, so the function
-- still passes through the Garage RLS policies without granting clients direct
-- INSERT access to garage_sessions.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'setupsheet_garage_writer') then
    create role setupsheet_garage_writer
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

alter role setupsheet_garage_writer
  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

grant usage, create on schema public to setupsheet_garage_writer;
grant usage on schema auth to setupsheet_garage_writer;
grant execute on function auth.uid() to setupsheet_garage_writer;

create table public.garage_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_setup_id uuid references public.setups (id) on delete set null,
  game text not null check (game in ('Assetto Corsa Competizione', 'Le Mans Ultimate')),
  car text not null check (char_length(btrim(car)) between 1 and 80),
  track text not null check (char_length(btrim(track)) between 1 and 80),
  condition text not null check (condition in ('Dry', 'Wet', 'Mixed')),
  rig text check (
    rig is null or rig in (
      'Wheel + 3 Pedals', 'Wheel + Handbrake',
      'Direct Drive + Load Cell', 'Gamepad'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index garage_sessions_user_created_idx
  on public.garage_sessions (user_id, created_at desc, id desc);
create index garage_sessions_source_setup_idx
  on public.garage_sessions (source_setup_id)
  where source_setup_id is not null;

create table public.garage_revisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.garage_sessions (id) on delete cascade,
  setup_values jsonb not null default '{}'::jsonb
    check (public.is_valid_setup_values(setup_values)),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  unique (session_id, id)
);

create index garage_revisions_session_created_idx
  on public.garage_revisions (session_id, created_at asc, id asc);

create table public.garage_run_plan_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  revision_id uuid not null,
  parameter text not null check (char_length(btrim(parameter)) between 1 and 120),
  direction text not null check (direction in ('increase', 'decrease', 'soften', 'stiffen')),
  amount text not null check (char_length(btrim(amount)) between 1 and 100),
  verdict text not null check (verdict in ('better', 'worse', 'inconclusive')),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  foreign key (session_id, revision_id)
    references public.garage_revisions (session_id, id) on delete cascade
);

create index garage_run_plan_session_created_idx
  on public.garage_run_plan_items (session_id, created_at desc, id desc);
create index garage_run_plan_revision_idx
  on public.garage_run_plan_items (session_id, revision_id);

create table public.garage_laps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  revision_id uuid not null,
  lap_time_ms integer not null check (lap_time_ms between 10000 and 1800000),
  condition text not null check (condition in ('Dry', 'Wet', 'Mixed')),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  foreign key (session_id, revision_id)
    references public.garage_revisions (session_id, id) on delete cascade
);

create index garage_laps_session_created_idx
  on public.garage_laps (session_id, created_at desc, id desc);
create index garage_laps_revision_idx
  on public.garage_laps (session_id, revision_id);

-- All four tables contain private user data. The parent session is the sole
-- ownership root; child access is checked through that row, never a client ID.
alter table public.garage_sessions enable row level security;
alter table public.garage_revisions enable row level security;
alter table public.garage_run_plan_items enable row level security;
alter table public.garage_laps enable row level security;

create policy "Users and garage writer can read their own sessions"
  on public.garage_sessions for select to authenticated, setupsheet_garage_writer
  using (user_id = auth.uid());

create policy "Garage writer can create owned sessions"
  on public.garage_sessions for insert to setupsheet_garage_writer
  with check (user_id = auth.uid());

create policy "Users can delete their own garage sessions"
  on public.garage_sessions for delete to authenticated
  using (user_id = auth.uid());

create policy "Users and garage writer can read revisions through owned sessions"
  on public.garage_revisions for select to authenticated, setupsheet_garage_writer
  using (
    exists (
      select 1 from public.garage_sessions s
      where s.id = garage_revisions.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users and garage writer can create revisions through owned sessions"
  on public.garage_revisions for insert to authenticated, setupsheet_garage_writer
  with check (
    exists (
      select 1 from public.garage_sessions s
      where s.id = garage_revisions.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can read run-plan items through their own session"
  on public.garage_run_plan_items for select to authenticated
  using (
    exists (
      select 1 from public.garage_sessions s
      where s.id = garage_run_plan_items.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can create run-plan items through their own session"
  on public.garage_run_plan_items for insert to authenticated
  with check (
    exists (
      select 1 from public.garage_sessions s
      where s.id = garage_run_plan_items.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can read laps through their own session"
  on public.garage_laps for select to authenticated
  using (
    exists (
      select 1 from public.garage_sessions s
      where s.id = garage_laps.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can create laps through their own session"
  on public.garage_laps for insert to authenticated
  with check (
    exists (
      select 1 from public.garage_sessions s
      where s.id = garage_laps.session_id
        and s.user_id = auth.uid()
    )
  );

-- Do not rely on Supabase's project-wide default grants. Anonymous users have
-- no table access; authenticated users get only the operations and columns
-- used by the Garage Server Actions. Timestamps, row IDs, and source metadata
-- remain database-owned in this first workflow slice.
revoke all on public.garage_sessions from PUBLIC, anon, authenticated, setupsheet_garage_writer;
revoke all on public.garage_revisions from PUBLIC, anon, authenticated, setupsheet_garage_writer;
revoke all on public.garage_run_plan_items from PUBLIC, anon, authenticated, setupsheet_garage_writer;
revoke all on public.garage_laps from PUBLIC, anon, authenticated, setupsheet_garage_writer;

grant select, delete on public.garage_sessions to authenticated;
grant select on public.garage_sessions to setupsheet_garage_writer;
grant insert (user_id, game, car, track, condition, rig)
  on public.garage_sessions to setupsheet_garage_writer;

grant select on public.garage_revisions to authenticated;
grant insert (session_id, setup_values, note)
  on public.garage_revisions to authenticated;
grant select on public.garage_revisions to setupsheet_garage_writer;
grant insert (session_id, setup_values, note)
  on public.garage_revisions to setupsheet_garage_writer;

grant select on public.garage_run_plan_items to authenticated;
grant insert (session_id, revision_id, parameter, direction, amount, verdict, note)
  on public.garage_run_plan_items to authenticated;

grant select on public.garage_laps to authenticated;
grant insert (session_id, revision_id, lap_time_ms, condition, note)
  on public.garage_laps to authenticated;

create or replace function public.touch_garage_session_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger garage_sessions_touch_updated_at
  before update on public.garage_sessions
  for each row execute function public.touch_garage_session_updated_at();

-- Session + baseline revision are one transaction. The caller identity comes
-- from auth.uid(), not a browser-supplied user ID. The function runs as the
-- non-login garage writer role, which has only scoped table privileges and is
-- subject to the same ownership RLS policies as authenticated users.
create or replace function public.create_garage_session_with_baseline(
  p_game text,
  p_car text,
  p_track text,
  p_condition text,
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
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.garage_sessions (user_id, game, car, track, condition, rig)
  values (v_user_id, p_game, btrim(p_car), btrim(p_track), p_condition, p_rig)
  returning id into v_session_id;

  insert into public.garage_revisions (session_id, setup_values, note)
  values (v_session_id, p_setup_values, coalesce(p_note, ''));

  return v_session_id;
end;
$$;

alter function public.create_garage_session_with_baseline(text, text, text, text, text, jsonb, text)
  owner to setupsheet_garage_writer;
revoke create on schema public from setupsheet_garage_writer;
revoke all on function public.create_garage_session_with_baseline(text, text, text, text, text, jsonb, text)
  from public, anon;
grant execute on function public.create_garage_session_with_baseline(text, text, text, text, text, jsonb, text)
  to authenticated;
