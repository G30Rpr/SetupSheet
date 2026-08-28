-- Provide an authenticated, auditable account/data-deletion request path
-- without exposing the Supabase service role to the application. A trusted
-- operator or scheduled backend process must complete the actual auth.user
-- deletion; contributors can only create, view, or cancel their own pending
-- request.

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in (
    'pending', 'processing', 'completed', 'cancelled'
  )),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index account_deletion_requests_active_user_idx
  on public.account_deletion_requests (user_id)
  where status in ('pending', 'processing');

create index account_deletion_requests_created_at_idx
  on public.account_deletion_requests (created_at desc);

alter table public.account_deletion_requests enable row level security;

create policy "Users can view their own deletion requests"
  on public.account_deletion_requests for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can request deletion for themselves"
  on public.account_deletion_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can cancel their pending deletion request"
  on public.account_deletion_requests for delete
  to authenticated
  using (auth.uid() = user_id and status = 'pending');

-- Do not allow direct callers to set workflow state or timestamps.
revoke all on public.account_deletion_requests from anon, authenticated;
grant select (id, user_id, status, created_at, completed_at)
  on public.account_deletion_requests to authenticated;
grant insert (user_id)
  on public.account_deletion_requests to authenticated;
grant delete
  on public.account_deletion_requests to authenticated;
