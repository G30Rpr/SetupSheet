-- Regression coverage for 0020_create_setup_with_rating.sql. An invalid
-- initial rating must roll back the setup row rather than publishing a setup
-- with a zero aggregate.

create or replace function auth.uid() returns uuid language sql stable as
  $$ select '33333333-3333-4333-8333-333333333333'::uuid $$;

do $$
declare
  before_count integer;
  after_count integer;
begin
  select count(*) into before_count from public.setups;

  begin
    perform public.create_setup_with_rating(
      'iRacing', 'BMW M4 GT3', 'Spa-Francorchamps', 'Dry', null,
      'transaction test', '{}'::text[], 'Wheel + 3 Pedals', null::jsonb,
      null, null, null, null, null, 0::smallint, 3::smallint
    );
    raise exception 'REGRESSION: atomic setup RPC accepted an invalid rating';
  exception when check_violation then
    raise notice 'CHECK 1 passed: invalid initial rating rejected';
  end;

  select count(*) into after_count from public.setups;
  if after_count <> before_count then
    raise exception 'REGRESSION: failed atomic setup RPC left a setup row behind';
  end if;
  raise notice 'CHECK 2 passed: failed setup creation rolled back';
end $$;
