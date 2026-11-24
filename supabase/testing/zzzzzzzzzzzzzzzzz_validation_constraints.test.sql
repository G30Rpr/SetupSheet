-- Every reviewed check must reject its specific invalid write. These fixture
-- transactions are run only in the disposable migration test database.
begin;
insert into auth.users(id,email) values
  ('a6666666-6666-4666-8666-666666666666','validation-owner@example.test');
insert into public.setups(id,user_id,game,car,track,condition,description,rig_profile) values
  ('b6666666-6666-4666-8666-666666666666','a6666666-6666-4666-8666-666666666666',
   'iRacing','Porsche 992 GT3 Cup','Spa-Francorchamps','Dry','valid fixture','Gamepad');
insert into public.setup_versions(id,setup_id,edited_by,game,car,track,condition,description,rig_profile) values
  ('c6666666-6666-4666-8666-666666666666','b6666666-6666-4666-8666-666666666666','a6666666-6666-4666-8666-666666666666',
   'iRacing','Porsche 992 GT3 Cup','Spa-Francorchamps','Dry','valid fixture','Gamepad');
insert into public.setup_requests(id,requester_id,game,car,track,notes) values
  ('d6666666-6666-4666-8666-666666666666','a6666666-6666-4666-8666-666666666666',
   'iRacing','Porsche 992 GT3 Cup','Spa-Francorchamps','valid fixture');
insert into public.setup_comments(id,setup_id,user_id,body) values
  ('e6666666-6666-4666-8666-666666666666','b6666666-6666-4666-8666-666666666666',
   'a6666666-6666-4666-8666-666666666666','valid comment');

do $$
declare candidate record; failed_constraint text;
begin
  for candidate in select * from (values
    ('profiles','profiles_username_length_check',$bad$username = ''$bad$,'a6666666-6666-4666-8666-666666666666'::uuid),
    ('profiles','profiles_avatar_url_check',$bad$avatar_url = 'http://example.test/avatar.png'$bad$,'a6666666-6666-4666-8666-666666666666'::uuid),
    ('setups','setups_car_length_check',$bad$car = ''$bad$,'b6666666-6666-4666-8666-666666666666'::uuid),
    ('setups','setups_track_length_check',$bad$track = ''$bad$,'b6666666-6666-4666-8666-666666666666'::uuid),
    ('setups','setups_lap_time_length_check',$bad$lap_time = repeat('x',33)$bad$,'b6666666-6666-4666-8666-666666666666'::uuid),
    ('setups','setups_description_length_check',$bad$description = repeat('x',2001)$bad$,'b6666666-6666-4666-8666-666666666666'::uuid),
    ('setups','setups_setup_values_shape_check',$bad$setup_values = '{"wing":{"nested":1}}'::jsonb$bad$,'b6666666-6666-4666-8666-666666666666'::uuid),
    ('setups','setups_file_path_owner_check',$bad$file_path = 'f6666666-6666-4666-8666-666666666666/object.json', file_name = 'object.json'$bad$,'b6666666-6666-4666-8666-666666666666'::uuid),
    ('setups','setups_file_name_pair_check',$bad$file_name = 'object.json'$bad$,'b6666666-6666-4666-8666-666666666666'::uuid),
    ('setups','setups_telemetry_path_owner_check',$bad$telemetry_file_path = 'f6666666-6666-4666-8666-666666666666/object.csv', telemetry_file_name = 'object.csv'$bad$,'b6666666-6666-4666-8666-666666666666'::uuid),
    ('setups','setups_telemetry_name_pair_check',$bad$telemetry_file_name = 'object.csv'$bad$,'b6666666-6666-4666-8666-666666666666'::uuid),
    ('setups','setups_video_url_check',$bad$video_url = 'https://example.test/video'$bad$,'b6666666-6666-4666-8666-666666666666'::uuid),
    ('setup_versions','setup_versions_car_length_check',$bad$car = ''$bad$,'c6666666-6666-4666-8666-666666666666'::uuid),
    ('setup_versions','setup_versions_track_length_check',$bad$track = ''$bad$,'c6666666-6666-4666-8666-666666666666'::uuid),
    ('setup_versions','setup_versions_description_length_check',$bad$description = repeat('x',2001)$bad$,'c6666666-6666-4666-8666-666666666666'::uuid),
    ('setup_versions','setup_versions_setup_values_shape_check',$bad$setup_values = '{"wing":[]}'::jsonb$bad$,'c6666666-6666-4666-8666-666666666666'::uuid),
    ('setup_versions','setup_versions_file_name_length_check',$bad$file_name = ''$bad$,'c6666666-6666-4666-8666-666666666666'::uuid),
    ('setup_versions','setup_versions_video_url_check',$bad$video_url = 'https://example.test/video'$bad$,'c6666666-6666-4666-8666-666666666666'::uuid),
    ('setup_requests','setup_requests_car_length_check',$bad$car = ''$bad$,'d6666666-6666-4666-8666-666666666666'::uuid),
    ('setup_requests','setup_requests_track_length_check',$bad$track = ''$bad$,'d6666666-6666-4666-8666-666666666666'::uuid),
    ('setup_requests','setup_requests_notes_length_check',$bad$notes = repeat('x',2001)$bad$,'d6666666-6666-4666-8666-666666666666'::uuid),
    ('setup_comments','setup_comments_body_not_blank',$bad$body = '   '$bad$,'e6666666-6666-4666-8666-666666666666'::uuid)
  ) cases(table_name,check_name,assignment,row_id)
  loop
    begin
      execute format('update public.%I set %s where id = $1',candidate.table_name,candidate.assignment)
        using candidate.row_id;
      raise exception 'Invalid write accepted for %',candidate.check_name;
    exception when check_violation then
      get stacked diagnostics failed_constraint = constraint_name;
      if failed_constraint <> candidate.check_name then
        raise exception 'Expected %, received %',candidate.check_name,failed_constraint;
      end if;
    end;
  end loop;
end $$;

-- Exercise a real API role too: ownership and editable-field grants must allow
-- a valid insert, while the database rejects the overlong description.
create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
select set_config('request.jwt.claim.sub','a6666666-6666-4666-8666-666666666666',true);
set local role authenticated;
insert into public.setups(user_id,game,car,track,condition,description,rig_profile) values
  ('a6666666-6666-4666-8666-666666666666','iRacing','Porsche 992 GT3 Cup','Spa-Francorchamps','Dry','API role positive control','Gamepad');
do $$
declare failed_constraint text;
begin
  insert into public.setups(user_id,game,car,track,condition,description,rig_profile) values
    ('a6666666-6666-4666-8666-666666666666','iRacing','Porsche 992 GT3 Cup','Spa-Francorchamps','Dry',repeat('x',2001),'Gamepad');
  raise exception 'Direct API role bypassed description validation';
exception when check_violation then
  get stacked diagnostics failed_constraint = constraint_name;
  if failed_constraint <> 'setups_description_length_check' then raise; end if;
end $$;
reset role;
rollback;
