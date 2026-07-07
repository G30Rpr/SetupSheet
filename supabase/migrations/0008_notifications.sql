-- In-app notifications: tells a user when someone they follow uploads a
-- new setup. One row per (recipient, setup) event. RLS scoped to the
-- recipient's own rows only, same shape as setup_ratings/setup_upvotes --
-- inserts happen exclusively via the fan-out trigger below (SECURITY
-- DEFINER, so it can write rows for any recipient regardless of whose
-- setup triggered it), so there's no user-facing insert policy at all.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  setup_id uuid references public.setups (id) on delete cascade,
  type text not null default 'new_setup' check (type in ('new_setup')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can mark their own notifications read"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fan-out: whenever a setup is inserted, notify every follower of its
-- uploader. Runs regardless of who owns the notifications rows being
-- created, hence SECURITY DEFINER (same reasoning as handle_upvote_insert
-- in 0001 -- a normal INSERT would only be visible to/allowed for the
-- recipient's own policy above, not the uploader inserting on their behalf).
create function public.handle_new_setup_notify_followers()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, setup_id, type)
  select follower_id, new.user_id, new.id, 'new_setup'
  from public.follows
  where followed_id = new.user_id;
  return new;
end;
$$;

create trigger on_setup_created_notify_followers
  after insert on public.setups
  for each row execute function public.handle_new_setup_notify_followers();
