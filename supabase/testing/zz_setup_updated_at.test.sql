-- Regression coverage for 0022_setup_updated_at.sql. Public freshness should
-- advance for an owner-editable field but not for a denormalized counter bump.
--
-- Every statement below must stay separate: touch_setup_updated_at() stamps
-- now(), and now() is frozen for the whole transaction, so wrapping the insert,
-- the edit and the comparison in one DO block made the assertion compare a
-- timestamp with itself -- it failed no matter what the trigger did (and, being
-- a single psql statement, in CI too). pg_sleep is a statement of its own for
-- the same reason.
--
-- The temp table carries values across those transactions; it is dropped at the
-- end of the file so a later test file in the same session can't collide.

create temp table _updated_at_probe (
  before_edit timestamptz,
  after_edit timestamptz,
  after_counter timestamptz
);
insert into _updated_at_probe (before_edit) values (null);

insert into public.setups (
  id, user_id, game, car, track, condition, description, tags, rig_profile
) values (
  'ffffffff-ffff-4fff-8fff-ffffffffffff', '33333333-3333-4333-8333-333333333333',
  'iRacing', 'BMW M4 GT3', 'Road Atlanta', 'Dry', 'before edit', '{}', 'Wheel + 3 Pedals'
);

\echo 'CHECK 1: setup edits advance updated_at'
update _updated_at_probe
  set before_edit = (select updated_at from public.setups
                     where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff');

select pg_sleep(0.02);

update public.setups set description = 'after edit'
  where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

update _updated_at_probe
  set after_edit = (select updated_at from public.setups
                    where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff');

do $$
declare
  before_edit timestamptz;
  after_edit timestamptz;
begin
  select p.before_edit, p.after_edit into before_edit, after_edit from _updated_at_probe p;
  if after_edit <= before_edit then
    raise exception 'REGRESSION: setup content edit did not advance updated_at';
  end if;
  raise notice 'CHECK 1 passed';
end $$;

\echo 'CHECK 2: counter-only updates leave updated_at alone'
select pg_sleep(0.02);

update public.setups set downloads = downloads + 1
  where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

update _updated_at_probe
  set after_counter = (select updated_at from public.setups
                       where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff');

do $$
declare
  after_edit timestamptz;
  after_counter timestamptz;
begin
  select p.after_edit, p.after_counter into after_edit, after_counter from _updated_at_probe p;
  if after_counter is distinct from after_edit then
    raise exception 'REGRESSION: counter-only update changed updated_at';
  end if;
  raise notice 'CHECK 2 passed';
end $$;

drop table _updated_at_probe;

\echo 'Setup freshness checks passed.'
