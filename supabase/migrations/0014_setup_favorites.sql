-- Favorites: a private "saved for later" list, separate from upvotes (a
-- public signal) and downloads (an action). One row per (user, setup) pair,
-- same shape as setup_upvotes -- select restricted to the user's own rows,
-- since nobody else needs to know what you've saved.

create table public.setup_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  setup_id uuid not null references public.setups (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, setup_id)
);

create index setup_favorites_user_id_idx on public.setup_favorites (user_id, created_at desc);

alter table public.setup_favorites enable row level security;

create policy "Users can view their own favorites"
  on public.setup_favorites for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can favorite as themselves"
  on public.setup_favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can unfavorite as themselves"
  on public.setup_favorites for delete
  to authenticated
  using (auth.uid() = user_id);
