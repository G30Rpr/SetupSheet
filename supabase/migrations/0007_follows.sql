-- Follow system: lets a user follow specific setup builders. Mirrors the
-- setup_upvotes pattern in 0001 -- one row per (follower, followed) pair,
-- select restricted to the follower's own rows (a viewer only ever needs
-- to check "do I follow this person"). profiles.follower_count is
-- denormalized via trigger, same as setups.upvotes, so profile pages can
-- show a follower count without opening follows up to public SELECT.

alter table public.profiles add column follower_count integer not null default 0;

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followed_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_not_self check (follower_id <> followed_id)
);

create index follows_followed_id_idx on public.follows (followed_id);

alter table public.follows enable row level security;

create policy "Users can view their own follows"
  on public.follows for select
  to authenticated
  using (auth.uid() = follower_id);

create policy "Users can follow as themselves"
  on public.follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

create policy "Users can unfollow as themselves"
  on public.follows for delete
  to authenticated
  using (auth.uid() = follower_id);

create function public.handle_follow_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set follower_count = follower_count + 1 where id = new.followed_id;
  return new;
end;
$$;

create trigger on_follow_added
  after insert on public.follows
  for each row execute function public.handle_follow_insert();

create function public.handle_follow_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set follower_count = greatest(follower_count - 1, 0) where id = old.followed_id;
  return old;
end;
$$;

create trigger on_follow_removed
  after delete on public.follows
  for each row execute function public.handle_follow_delete();
