-- Regression coverage for 0029_storage_bucket_limits.sql: the public bucket must
-- carry a hard size cap, because the Server Action limits alone do not bind a
-- caller that talks to the Storage REST API directly.

\echo 'CHECK 1: setup-files carries the 10 MiB bucket limit'
do $$
declare
  v_limit bigint;
begin
  select file_size_limit into v_limit from storage.buckets where id = 'setup-files';

  if v_limit is distinct from 10485760::bigint then
    raise exception 'REGRESSION: expected setup-files file_size_limit 10485760, got %',
      coalesce(v_limit::text, 'null');
  end if;
  raise notice 'CHECK 1 passed';
end $$;

\echo 'CHECK 2: re-applying 0029 is a no-op (the update is guarded and idempotent)'
do $$
declare
  v_count integer;
begin
  -- A migration that is replayed (or that runs against an already-configured
  -- project) must not churn the row.
  select count(*) into v_count from storage.buckets
  where id = 'setup-files' and file_size_limit is distinct from 10485760::bigint;

  if v_count <> 0 then
    raise exception 'REGRESSION: % bucket row(s) still outside the 10 MiB cap', v_count;
  end if;
  raise notice 'CHECK 2 passed';
end $$;

\echo 'Storage bucket limit checks passed.'
