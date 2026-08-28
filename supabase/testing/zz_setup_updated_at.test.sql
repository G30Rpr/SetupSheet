-- Regression coverage for 0022_setup_updated_at.sql. Public freshness should
-- advance for an owner-editable field but not for a denormalized counter bump.

\echo 'CHECK 1: setup edits advance updated_at'
do $$
declare
  setup_id uuid := 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  before_edit timestamptz;
  after_edit timestamptz;
  after_counter timestamptz;
begin
  insert into public.setups (
    id, user_id, game, car, track, condition, description, tags, rig_profile
  ) values (
    setup_id, '33333333-3333-4333-8333-333333333333', 'iRacing', 'BMW M4 GT3',
    'Road Atlanta', 'Dry', 'before edit', '{}', 'Wheel + 3 Pedals'
  );

  select updated_at into before_edit from public.setups where id = setup_id;
  perform pg_sleep(0.02);
  update public.setups set description = 'after edit' where id = setup_id;
  select updated_at into after_edit from public.setups where id = setup_id;

  if after_edit <= before_edit then
    raise exception 'REGRESSION: setup content edit did not advance updated_at';
  end if;
  raise notice 'CHECK 1 passed';

  perform pg_sleep(0.02);
  update public.setups set downloads = downloads + 1 where id = setup_id;
  select updated_at into after_counter from public.setups where id = setup_id;

  if after_counter is distinct from after_edit then
    raise exception 'REGRESSION: counter-only update changed updated_at';
  end if;
  raise notice 'CHECK 2 passed';
end $$;

\echo 'Setup freshness checks passed.'
