-- Comments: a public discussion thread under each setup. No edit-in-place
-- (post or delete only, same simplicity as the rest of this app's
-- one-shot-write content) -- length is bounded at the app layer
-- (validateCommentBody), same as car/track/description on setups.

create table public.setup_comments (
  id uuid primary key default gen_random_uuid(),
  setup_id uuid not null references public.setups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index setup_comments_setup_id_idx on public.setup_comments (setup_id, created_at);

alter table public.setup_comments enable row level security;

create policy "Comments are viewable by everyone"
  on public.setup_comments for select
  using (true);

create policy "Users can post comments as themselves"
  on public.setup_comments for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete their own comments"
  on public.setup_comments for delete
  to authenticated
  using (auth.uid() = user_id);

-- Fan-out: notify a setup's owner when someone else comments on it (no
-- self-notification for commenting on your own setup). Same
-- security-definer reasoning as handle_new_setup_notify_followers in 0008
-- -- a normal insert would only be visible to/allowed for the recipient's
-- own policy, not the commenter inserting on their behalf.
create function public.handle_new_comment_notify_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  select user_id into v_owner_id from public.setups where id = new.setup_id;

  if v_owner_id is not null and v_owner_id <> new.user_id then
    insert into public.notifications (user_id, actor_id, setup_id, type)
    values (v_owner_id, new.user_id, new.setup_id, 'new_comment');
  end if;

  return new;
end;
$$;

create trigger on_comment_created_notify_owner
  after insert on public.setup_comments
  for each row execute function public.handle_new_comment_notify_owner();

-- Widen notifications.type again for the new kind emitted above -- same
-- default-constraint-naming caveat noted in 0013.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('new_setup', 'request_fulfilled', 'new_comment'));
