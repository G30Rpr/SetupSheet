-- Regression coverage for 0025_account_deletion_requests.sql.

create or replace function auth.uid() returns uuid language sql stable as
  $$ select '33333333-3333-4333-8333-333333333333'::uuid $$;

\echo 'CHECK 1: one active deletion request per account'
do $$
declare
  request_id uuid;
  request_status text;
begin
  insert into public.account_deletion_requests (user_id)
  values ('33333333-3333-4333-8333-333333333333')
  returning id, status into request_id, request_status;

  if request_status <> 'pending' then
    raise exception 'REGRESSION: deletion request did not default to pending';
  end if;

  begin
    insert into public.account_deletion_requests (user_id)
    values ('33333333-3333-4333-8333-333333333333');
    raise exception 'REGRESSION: duplicate active deletion request was accepted';
  exception when unique_violation then
    raise notice 'CHECK 1 passed';
  end;

  delete from public.account_deletion_requests where id = request_id;
end $$;

\echo 'Account deletion request checks passed.'
