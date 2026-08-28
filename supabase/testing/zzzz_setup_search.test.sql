-- Regression coverage for 0024_setup_search_view.sql.

\echo 'CHECK 1: setup search view exposes the public author name'
do $$
declare
  v_author text;
begin
  select author_username
    into v_author
    from public.setup_search
    where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  if v_author is distinct from 'validator' then
    raise exception 'REGRESSION: setup_search did not expose the expected author name';
  end if;
  raise notice 'CHECK 1 passed';
end $$;

\echo 'Setup author search checks passed.'
