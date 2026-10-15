-- Regression coverage for create_setup_with_rating() under the rating trust
-- rules (0036). Publishing a setup no longer seeds an uploader self-rating:
-- the setup starts Unrated and the legacy p_pace/p_predictability parameters
-- are accepted but ignored.

create or replace function auth.uid() returns uuid language sql stable as
  $$ select '33333333-3333-4333-8333-333333333333'::uuid $$;

\echo 'CHECK 1: publishing creates an Unrated setup with no rating row'
do $$
declare
  v_setup_id uuid;
  v_pace numeric;
  v_rating_count integer;
begin
  select public.create_setup_with_rating(
    'iRacing', 'BMW M4 GT3', 'Spa-Francorchamps', 'Dry', null,
    'trust layer test', '{}'::text[], 'Wheel + 3 Pedals', null::jsonb,
    null, null, null, null, null, 5::smallint, 5::smallint
  ) into v_setup_id;

  select pace, rating_count into v_pace, v_rating_count
    from public.setups where id = v_setup_id;

  if v_pace <> 0 or v_rating_count <> 0 then
    raise exception 'REGRESSION: new setup has aggregates without community ratings (pace=%, count=%)',
      v_pace, v_rating_count;
  end if;

  if exists (select 1 from public.setup_ratings where setup_id = v_setup_id) then
    raise exception 'REGRESSION: create_setup_with_rating inserted a self-rating row';
  end if;

  raise notice 'CHECK 1 passed: setup % is Unrated with no rating row', v_setup_id;
end $$;

\echo 'Create-setup trust checks passed.'
