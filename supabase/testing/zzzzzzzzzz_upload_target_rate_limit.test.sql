-- Regression coverage for the shared, atomic signed-upload-target limiter.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'rate-a@example.test', '{}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'rate-b@example.test', '{}'::jsonb)
on conflict (id) do nothing;

create or replace function auth.uid() returns uuid language sql stable as
  $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;

do $$
declare
  i integer;
begin
  for i in 1..30 loop
    if not public.consume_upload_target_rate_limit() then
      raise exception 'REGRESSION: upload target limit blocked request % of 30', i;
    end if;
  end loop;

  if public.consume_upload_target_rate_limit() then
    raise exception 'REGRESSION: upload target limit allowed request 31';
  end if;
  raise notice 'CHECK 1 passed: the 31st request is denied';
end $$;

-- A new user has a distinct counter.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select '22222222-2222-4222-8222-222222222222'::uuid $$;

do $$
begin
  if not public.consume_upload_target_rate_limit() then
    raise exception 'REGRESSION: one user consumed another user''s limit';
  end if;
  raise notice 'CHECK 2 passed: limits are per-user';
end $$;

-- Simulate an expired window, then verify that it starts over.
update public.upload_target_rate_limits
set window_started_at = clock_timestamp() - interval '2 hours'
where user_id = '11111111-1111-4111-8111-111111111111';

create or replace function auth.uid() returns uuid language sql stable as
  $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;

do $$
begin
  if not public.consume_upload_target_rate_limit() then
    raise exception 'REGRESSION: expired upload target window did not reset';
  end if;
  raise notice 'CHECK 3 passed: expired window resets';
end $$;

DO $$
begin
  if has_function_privilege('anon', 'public.consume_upload_target_rate_limit()', 'execute') then
    raise exception 'REGRESSION: anon can execute upload limiter';
  end if;
  if not has_function_privilege('authenticated', 'public.consume_upload_target_rate_limit()', 'execute') then
    raise exception 'REGRESSION: authenticated cannot execute upload limiter';
  end if;
  if has_table_privilege('authenticated', 'public.upload_target_rate_limits', 'select') then
    raise exception 'REGRESSION: authenticated can read upload limiter state';
  end if;
  raise notice 'CHECK 4 passed: limiter privileges are restricted';
end $$;
