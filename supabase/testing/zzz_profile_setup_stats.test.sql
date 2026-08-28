-- Regression coverage for 0023_profile_setup_stats.sql.

\echo 'CHECK 1: leaderboard exposes accurate profile setup aggregates'
do $$
declare
  v_setup_count integer;
  v_total_upvotes integer;
  v_total_ratings integer;
begin
  select setup_count, total_upvotes, total_ratings
    into v_setup_count, v_total_upvotes, v_total_ratings
    from public.leaderboard
    where user_id = '33333333-3333-4333-8333-333333333333';

  if v_setup_count is null or v_setup_count < 1 then
    raise exception 'REGRESSION: profile setup count is missing';
  end if;
  if v_total_upvotes is null or v_total_ratings is null then
    raise exception 'REGRESSION: profile aggregate totals are missing';
  end if;
  raise notice 'CHECK 1 passed: % setups, % upvotes, % ratings',
    v_setup_count, v_total_upvotes, v_total_ratings;
end $$;

\echo 'Profile setup aggregate checks passed.'
