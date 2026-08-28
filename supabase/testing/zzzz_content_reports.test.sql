-- Regression coverage for 0026_content_reports.sql.

create or replace function auth.uid() returns uuid language sql stable as
  $$ select '33333333-3333-4333-8333-333333333333'::uuid $$;

\echo 'CHECK 1: duplicate active reports are rejected'
do $$
declare
  first_report_id uuid;
begin
  insert into public.content_reports (
    reporter_id, target_type, target_id, reason, details
  ) values (
    '33333333-3333-4333-8333-333333333333', 'setup',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'spam', 'first report'
  ) returning id into first_report_id;

  begin
    insert into public.content_reports (
      reporter_id, target_type, target_id, reason
    ) values (
      '33333333-3333-4333-8333-333333333333', 'setup',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'spam'
    );
    raise exception 'REGRESSION: duplicate active report was accepted';
  exception when unique_violation then
    raise notice 'CHECK 1 passed';
  end;

  delete from public.content_reports where id = first_report_id;
end $$;

\echo 'Content report checks passed.'
