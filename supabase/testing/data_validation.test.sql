-- Regression coverage for the direct-API constraints added by migrations
-- 0018/0019. This file runs before the fulfillment test alphabetically.

insert into auth.users (id, email, raw_user_meta_data)
values
  ('33333333-3333-4333-8333-333333333333', 'validation@example.com', '{"full_name":"validator"}'::jsonb),
  ('44444444-4444-4444-8444-444444444444', null, '{"full_name":""}'::jsonb);

-- Empty OAuth display names must fall back to a bounded, usable profile.
do $$
begin
  if (select username from public.profiles where id = '44444444-4444-4444-8444-444444444444') <> 'Racer' then
    raise exception 'REGRESSION: empty OAuth name did not fall back to Racer';
  end if;
end $$;

insert into public.setups (id, user_id, game, car, track, condition, description, tags, rig_profile)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '33333333-3333-4333-8333-333333333333',
        'iRacing', 'BMW M4 GT3', 'Spa-Francorchamps', 'Dry', 'valid', '{}', 'Wheel + 3 Pedals');

\echo 'CHECK 1: malformed setup JSON values must be rejected'
do $$
begin
  insert into public.setups (user_id, game, car, track, condition, description, tags, rig_profile, setup_values)
    values ('33333333-3333-4333-8333-333333333333', 'iRacing', 'BMW M4 GT3', 'Spa-Francorchamps',
            'Dry', 'bad values', '{}', 'Wheel + 3 Pedals', '{"frontArb":{"value":3}}'::jsonb);
  raise exception 'REGRESSION: malformed setup_values were accepted';
exception when check_violation then
  raise notice 'CHECK 1 passed';
end $$;

\echo 'CHECK 2: a setup cannot point at another user folder'
do $$
begin
  insert into public.setups (user_id, game, car, track, condition, description, tags, rig_profile,
                             file_path, file_name)
    values ('33333333-3333-4333-8333-333333333333', 'iRacing', 'BMW M4 GT3', 'Spa-Francorchamps',
            'Dry', 'bad path', '{}', 'Wheel + 3 Pedals',
            '44444444-4444-4444-8444-444444444444/object.json', 'object.json');
  raise exception 'REGRESSION: cross-user attachment path was accepted';
exception when check_violation then
  raise notice 'CHECK 2 passed';
end $$;

\echo 'CHECK 3: unsafe proof URLs must be rejected'
do $$
begin
  insert into public.setups (user_id, game, car, track, condition, description, tags, rig_profile, video_url)
    values ('33333333-3333-4333-8333-333333333333', 'iRacing', 'BMW M4 GT3', 'Spa-Francorchamps',
            'Dry', 'bad URL', '{}', 'Wheel + 3 Pedals', 'javascript:alert(1)');
  raise exception 'REGRESSION: unsafe video URL was accepted';
exception when check_violation then
  raise notice 'CHECK 3 passed';
end $$;

\echo 'CHECK 4: overlong request text must be rejected'
do $$
begin
  insert into public.setup_requests (requester_id, game, car, track, notes)
    values ('33333333-3333-4333-8333-333333333333', 'iRacing', 'BMW M4 GT3', 'Spa-Francorchamps', repeat('x', 2001));
  raise exception 'REGRESSION: overlong request notes were accepted';
exception when check_violation then
  raise notice 'CHECK 4 passed';
end $$;

\echo 'All data validation checks passed.'
