-- SimSetups: profiles, setups, and upvotes schema with RLS.
-- Apply via the Supabase SQL Editor (Dashboard -> SQL Editor -> paste -> Run)
-- or `supabase db push` if you use the Supabase CLI locally.

-- ============================================================================
-- profiles
-- Mirrors the bits of auth.users we need to display (auth.users itself isn't
-- queryable via the client API). One row per user, auto-created on signup.
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up (i.e. first
-- Discord login), pulling the display name + avatar out of Discord's OAuth
-- metadata.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'user_name',
      split_part(new.email, '@', 1),
      'Racer'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- setups
-- ============================================================================

create table public.setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,

  game text not null check (game in (
    'iRacing', 'Assetto Corsa EVO', 'Assetto Corsa Competizione', 'Assetto Corsa',
    'Le Mans Ultimate', 'Automobilista 2',
    'F1 24', 'F1 23', 'F1 22', 'F1 21', 'F1 2020', 'F1 2019'
  )),
  car text not null,
  track text not null,
  condition text not null check (condition in ('Dry', 'Wet', 'Mixed')),
  lap_time text,
  description text not null default '',
  tags text[] not null default '{}'::text[] check (tags <@ array[
    'Safe', 'Beginner', 'Quali', 'Race', 'Aggressive', 'Wet Weather'
  ]::text[]),
  rig_profile text not null check (rig_profile in (
    'Wheel + 3 Pedals', 'Wheel + Handbrake', 'Direct Drive + Load Cell', 'Gamepad'
  )),

  -- Structured manual-entry fields (tire pressure, camber, ARB, etc.) — kept
  -- as a single jsonb blob since the fields are always read/written together
  -- and their exact shape may evolve; see SetupValues in src/lib/types.ts.
  setup_values jsonb,

  -- Set once real file storage (Supabase Storage) is wired up; null means
  -- the setup was entered manually rather than via a file upload.
  file_path text,

  pace smallint not null check (pace between 1 and 5),
  predictability smallint not null check (predictability between 1 and 5),
  upvotes integer not null default 0,
  downloads integer not null default 0,

  created_at timestamptz not null default now()
);

create index setups_game_idx on public.setups (game);
create index setups_user_id_idx on public.setups (user_id);
create index setups_upvotes_idx on public.setups (upvotes desc);

alter table public.setups enable row level security;

create policy "Setups are viewable by everyone"
  on public.setups for select
  using (true);

create policy "Users can insert their own setups"
  on public.setups for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own setups"
  on public.setups for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own setups"
  on public.setups for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================================
-- setup_upvotes
-- One row per (user, setup). Existence of a row = that user has upvoted.
-- setups.upvotes is a denormalized counter kept in sync by the triggers below
-- so the browse/landing pages can sort/display it without a join + count.
-- ============================================================================

create table public.setup_upvotes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  setup_id uuid not null references public.setups (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, setup_id)
);

alter table public.setup_upvotes enable row level security;

create policy "Users can view their own upvotes"
  on public.setup_upvotes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can upvote as themselves"
  on public.setup_upvotes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can remove their own upvote"
  on public.setup_upvotes for delete
  to authenticated
  using (auth.uid() = user_id);

-- Maintain setups.upvotes via SECURITY DEFINER triggers so the counter
-- updates regardless of who owns the setup (a normal UPDATE would be
-- blocked by the "own setups only" policy above).
create function public.handle_upvote_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.setups set upvotes = upvotes + 1 where id = new.setup_id;
  return new;
end;
$$;

create trigger on_upvote_added
  after insert on public.setup_upvotes
  for each row execute function public.handle_upvote_insert();

create function public.handle_upvote_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.setups set upvotes = greatest(upvotes - 1, 0) where id = old.setup_id;
  return old;
end;
$$;

create trigger on_upvote_removed
  after delete on public.setup_upvotes
  for each row execute function public.handle_upvote_delete();
