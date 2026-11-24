-- Restore 0019's supported-extension boundary on installations where the
-- migration ledger and Storage policy definitions have drifted apart.
-- No objects, bucket settings, grants or delete/read policies are changed.
do $migration$
declare
  expected record;
  actual record;
  statement text;
  previous_search_path text := pg_catalog.current_setting('search_path');
  previous_lock_timeout text := pg_catalog.current_setting('lock_timeout');
begin
  perform pg_catalog.set_config('search_path', 'pg_catalog', true);
  perform pg_catalog.set_config('lock_timeout', '5s', true);
  -- Additional write policies can OR away these restrictions. Require review
  -- rather than claiming protection when an unreviewed write path exists.
  if (select count(*) from pg_catalog.pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and cmd in ('INSERT', 'UPDATE', 'ALL')) <> 2 then
    raise exception 'Storage extension preflight: unexpected write policy inventory';
  end if;
  for expected in
    select * from (values
      ('Users can update their own setup files', 'UPDATE', '((bucket_id = ''setup-files''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))', '((bucket_id = ''setup-files''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))', '((bucket_id = ''setup-files''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND (lower(name) ~ ''.*\.(sto|json|ini|svm|sav|txt|xml|csv|ld|ldx|ibt|vbo|drf|zip|zvp|telemetry)$''::text))', '((bucket_id = ''setup-files''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND (lower(name) ~ ''.*\.(sto|json|ini|svm|sav|txt|xml|csv|ld|ldx|ibt|vbo|drf|zip|zvp|telemetry)$''::text))'),
      ('Users can upload setup files to their own folder', 'INSERT', NULL, '((bucket_id = ''setup-files''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))', NULL, '((bucket_id = ''setup-files''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND (lower(name) ~ ''.*\.(sto|json|ini|svm|sav|txt|xml|csv|ld|ldx|ibt|vbo|drf|zip|zvp|telemetry)$''::text))')
    ) as manifest(policy_name, command, old_using, old_check, new_using, new_check)
  loop
    select * into actual from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = expected.policy_name;
    if not found then
      raise exception 'Storage extension preflight: missing policy %', expected.policy_name;
    end if;
    if actual.cmd <> expected.command or actual.permissive <> 'PERMISSIVE'
       or actual.roles::text <> '{authenticated}'
       or not (
         (actual.qual is not distinct from expected.old_using
          and actual.with_check is not distinct from expected.old_check)
         or
         (actual.qual is not distinct from expected.new_using
          and actual.with_check is not distinct from expected.new_check)
       ) then
      raise exception 'Storage extension preflight: unexpected policy drift %', expected.policy_name;
    end if;
    if actual.qual is not distinct from expected.new_using
       and actual.with_check is not distinct from expected.new_check then
      continue;
    end if;
    statement := pg_catalog.format('alter policy %I on storage.objects', expected.policy_name);
    if expected.new_using is not null then
      statement := statement || pg_catalog.format(' using (%s)', expected.new_using);
    end if;
    statement := statement || pg_catalog.format(' with check (%s)', expected.new_check);
    execute statement;
  end loop;
  perform pg_catalog.set_config('search_path', previous_search_path, true);
  perform pg_catalog.set_config('lock_timeout', previous_lock_timeout, true);
end;
$migration$;
