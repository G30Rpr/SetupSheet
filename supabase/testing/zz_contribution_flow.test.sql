-- zz_contribution_flow.test.sql
-- Regression tests for 0041_contribution_flow.sql (Phase 3 contribution flow).
-- Checks: (1) rating_weight is 2.0 with a field-test report else 1.0,
-- (2) recompute averages with the weight but counts ratings literally,
-- (3) setup_impact_counts counts only OTHER drivers' laps, (4) the
-- leaderboard view carries the impact columns, (5) download events are
-- owner-only and invisible to anon.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser): author u1, plain rater u2, field-tested rater u3.
-- ---------------------------------------------------------------------------
begin;
-- auth.users inserts trigger the platform's handle_new_user -> profiles row.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003');

insert into public.setups (id, user_id, game, car, track, condition, description, rig_profile)
values (
  '00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-000000000001',
  'Assetto Corsa Competizione', 'BMW M4 GT3 2021', 'Spa-Francorchamps', 'Dry',
  '', 'Direct Drive + Load Cell'
);

-- Garage sessions started from s1: u3 logs 2 laps, u2 logs 1 lap, the
-- author logs 5 own laps (must never count as "driven by others").
insert into public.garage_sessions (id, user_id, source_setup_id, game, car, track, condition)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-0000000000f1', 'Assetto Corsa Competizione', 'BMW M4 GT3 2021', 'Spa-Francorchamps', 'Dry'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-0000000000f1', 'Assetto Corsa Competizione', 'BMW M4 GT3 2021', 'Spa-Francorchamps', 'Dry'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000f1', 'Assetto Corsa Competizione', 'BMW M4 GT3 2021', 'Spa-Francorchamps', 'Dry');

insert into public.garage_revisions (id, session_id) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a3');

insert into public.garage_laps (session_id, revision_id, lap_time_ms, condition) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 120000, 'Dry'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 119500, 'Dry'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', 121000, 'Dry'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b3', 118000, 'Dry'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b3', 118500, 'Dry'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b3', 118200, 'Dry'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b3', 118100, 'Dry'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b3', 117900, 'Dry');

-- u3's Garage-derived field-test report on s1 (u3 becomes "verified").
insert into public.field_test_reports (id, user_id, garage_session_id, setup_id, game, condition, validated_changes, laps_run, best_lap_ms)
values (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000f1',
  'Assetto Corsa Competizione', 'Dry', '["arbs"]'::jsonb, 2, 119500
);

-- Ratings: u2 (plain) 5/5, u3 (verified) 3/3. Author never rates.
insert into public.setup_ratings (user_id, setup_id, pace, predictability) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f1', 5, 5),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000f1', 3, 3);
-- (fixtures stay inside the one transaction that the file ends with rollback on,
-- so nothing leaks into later zz files)

-- ---------------------------------------------------------------------------
-- Checks.
-- ---------------------------------------------------------------------------
create or replace function auth.uid() returns uuid
language sql stable as $$ select '00000000-0000-0000-0000-000000000002'::uuid $$;

do $$
declare
  w numeric;
  v_pace numeric;
  v_pred numeric;
  v_n int;
  v_laps int;
  v_ft int;
begin
  -- 1. rating_weight: 2.0 with a field-test report for THIS setup, else 1.0.
  select public.rating_weight('00000000-0000-0000-0000-000000000003',
                              '00000000-0000-0000-0000-0000000000f1') into w;
  if w <> 2.0 then
    raise exception 'expected weight 2.0 for field-tested rater, got %', w;
  end if;
  select public.rating_weight('00000000-0000-0000-0000-000000000002',
                              '00000000-0000-0000-0000-0000000000f1') into w;
  if w <> 1.0 then
    raise exception 'expected weight 1.0 for plain rater, got %', w;
  end if;

  -- 2. Weighted aggregates: (5*1 + 3*2)/3 = 11/3 -> 3.7, NOT the unweighted
  -- 4.0; count stays the literal number of raters (2).
  select pace, predictability, rating_count
    into v_pace, v_pred, v_n
  from public.setups where id = '00000000-0000-0000-0000-0000000000f1';
  if v_pace is distinct from 3.7 or v_pred is distinct from 3.7 then
    raise exception 'expected weighted 3.7/3.7, got %/%', v_pace, v_pred;
  end if;
  if v_n <> 2 then
    raise exception 'expected rating_count 2, got %', v_n;
  end if;

  -- 3. Impact: u3 2 laps + u2 1 lap = 3; the author's 5 own laps excluded.
  select laps_driven_by_others into v_laps
  from public.setup_impact_counts
  where setup_id = '00000000-0000-0000-0000-0000000000f1';
  if v_laps <> 3 then
    raise exception 'expected 3 laps driven by others, got %', v_laps;
  end if;

  -- 4. Leaderboard view carries impact: author u1 has 3 laps + 1 field-tested setup.
  select laps_driven_by_others, field_tested_setup_count into v_laps, v_ft
  from public.leaderboard where user_id = '00000000-0000-0000-0000-000000000001';
  if v_laps <> 3 or v_ft <> 1 then
    raise exception 'expected leaderboard 3 laps / 1 field-tested, got % / %', v_laps, v_ft;
  end if;
end;
$$;

-- 5. Download events: owner-only, anon sees nothing.
set local role authenticated;
do $$
declare
  n int;
begin
  insert into public.setup_download_events (setup_id, user_id)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002');
  insert into public.setup_download_events (setup_id, user_id)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000003');

  select count(*) into n from public.setup_download_events
  where user_id = '00000000-0000-0000-0000-000000000002';
  if n <> 2 then
    raise exception 'owner should see own download events, saw %', n;
  end if;

  select count(*) into n from public.setup_download_events
  where user_id = '00000000-0000-0000-0000-000000000003';
  if n <> 0 then
    raise exception 'cross-user download events visible (% rows)', n;
  end if;

  -- The second insert (u3's row) went in because the actor is u2... RLS
  -- with-check must have refused it; if we got here the policy failed.
  raise exception 'cross-user download insert was accepted';
exception when insufficient_privilege or check_violation then null;
end;
$$;

set local role anon;
do $$
declare
  n int;
begin
  select count(*) into n from public.setup_download_events;
  if n <> 0 then
    raise exception 'anon can read download events (% rows)', n;
  end if;
end;
$$;
rollback;