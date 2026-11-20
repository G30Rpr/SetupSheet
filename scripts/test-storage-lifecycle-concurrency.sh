#!/usr/bin/env bash
# Real overlapping sessions against the already initialized disposable test DB.
set -euo pipefail
cd "$(dirname "$0")/.."
DB_NAME="${1:-}"
source scripts/assert-local-test-db.sh
assert_local_test_db "$DB_NAME"
work_dir=$(mktemp -d)
cleanup() { rm -rf "$work_dir"; }
trap cleanup EXIT
q() { psql -X -At -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"; }
wait_for_sleep() {
  local name=$1
  for ((attempt=0; attempt<100; attempt++)); do
    if [[ $(q -c "select count(*) from pg_stat_activity where datname = '$DB_NAME' and application_name = '$name' and wait_event = 'PgSleep'") == 1 ]]; then return; fi
    sleep 0.03
  done
  echo 'Concurrency barrier was not reached' >&2
  return 1
}
# Unique actors keep this fixture independent of all preceding test files.
q <<'SQL' >/dev/null
insert into auth.users(id,email) values
 ('73000000-0000-4000-8000-000000000001','storage-race-quota@test.local'),
 ('73000000-0000-4000-8000-000000000002','storage-race-attach@test.local');
create or replace function auth.uid() returns uuid language sql stable as
$$ select '73000000-0000-4000-8000-000000000002'::uuid $$;
insert into setupsheet_storage_private.objects(path,owner_id,state,upload_deadline)
select '73000000-0000-4000-8000-000000000001/' || gen_random_uuid() || '-quota.json',
 '73000000-0000-4000-8000-000000000001','ready','-infinity' from generate_series(1,99);
insert into storage.objects(bucket_id,name,created_at) values
 ('setup-files','73000000-0000-4000-8000-000000000002/attach-wins.json', now()-interval '7 days'),
 ('setup-files','73000000-0000-4000-8000-000000000002/cleanup-wins.json', now()-interval '7 days'),
 ('setup-files','73000000-0000-4000-8000-000000000002/repeatable-read.json', now()-interval '7 days'),
 ('setup-files','73000000-0000-4000-8000-000000000002/repeatable-empty.json', now()-interval '7 days');
insert into setupsheet_storage_private.objects(path,owner_id,state,upload_deadline,created_at)
select name, '73000000-0000-4000-8000-000000000002','ready','-infinity',now()-interval '7 days'
from storage.objects where name like '73000000-0000-4000-8000-000000000002/%' and name not like '%repeatable-empty.json';
SQL

ticket=$(q -c "select public.reserve_storage_upload('73000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000002/73000000-0000-4000-8000-000000000005-once.json', 'setup')")
name="storage_ticket_first_$$"
q >"$work_dir/ticket-first" 2>&1 <<SQL &
set application_name = '$name';
begin;
select public.begin_storage_upload('$ticket','73000000-0000-4000-8000-000000000002');
select pg_sleep(2);
commit;
SQL
first=$!
wait_for_sleep "$name"
second=$(q -c "select public.begin_storage_upload('$ticket','73000000-0000-4000-8000-000000000002')")
wait "$first"
[[ -z "$second" ]]

name="storage_quota_first_$$"
q >"$work_dir/quota-first" 2>&1 <<SQL &
set application_name = '$name';
begin;
select public.reserve_storage_upload('73000000-0000-4000-8000-000000000001',
 '73000000-0000-4000-8000-000000000001/73000000-0000-4000-8000-000000000003-last.json','setup');
select pg_sleep(2);
commit;
SQL
first=$!
wait_for_sleep "$name"
if q >"$work_dir/quota-second" 2>&1 <<'SQL'
select public.reserve_storage_upload('73000000-0000-4000-8000-000000000001',
 '73000000-0000-4000-8000-000000000001/73000000-0000-4000-8000-000000000004-overflow.json','setup');
SQL
then echo 'Concurrent quota overflow was allowed' >&2; exit 1; fi
wait "$first"
if ! grep -q 'Storage quota exceeded' "$work_dir/quota-second"; then cat "$work_dir/quota-second" >&2; exit 1; fi
[[ $(q -c "select count(*) from setupsheet_storage_private.objects where owner_id='73000000-0000-4000-8000-000000000001'") == 100 ]]

name="storage_attach_first_$$"
q >"$work_dir/attach-first" 2>&1 <<SQL &
set application_name = '$name';
begin;
insert into public.setups(user_id,game,car,track,condition,description,tags,rig_profile,file_path,file_name)
values ('73000000-0000-4000-8000-000000000002','iRacing','Test','Test','Dry','race','{}','Gamepad',
 '73000000-0000-4000-8000-000000000002/attach-wins.json','attach-wins.json');
select pg_sleep(2);
commit;
SQL
first=$!
wait_for_sleep "$name"
claim=$(q -c "select public.claim_storage_cleanup('73000000-0000-4000-8000-000000000002/attach-wins.json')")
wait "$first"
[[ -z "$claim" ]]

name="storage_cleanup_first_$$"
q >"$work_dir/cleanup-first" 2>&1 <<SQL &
set application_name = '$name';
begin;
select public.claim_storage_cleanup('73000000-0000-4000-8000-000000000002/cleanup-wins.json');
select pg_sleep(2);
commit;
SQL
first=$!
wait_for_sleep "$name"
if q >"$work_dir/cleanup-second" 2>&1 <<'SQL'
insert into public.setups(user_id,game,car,track,condition,description,tags,rig_profile,file_path,file_name)
values ('73000000-0000-4000-8000-000000000002','iRacing','Test','Test','Dry','race','{}','Gamepad',
 '73000000-0000-4000-8000-000000000002/cleanup-wins.json','cleanup-wins.json');
SQL
then echo 'Concurrent attachment to a claimed object was allowed' >&2; exit 1; fi
wait "$first"
if ! grep -q 'File is unavailable for attachment' "$work_dir/cleanup-second"; then cat "$work_dir/cleanup-second" >&2; exit 1; fi

for rr_file in repeatable-read.json repeatable-empty.json; do
name="storage_repeatable_read_$$"
q >"$work_dir/repeatable-read" 2>&1 <<SQL &
set application_name = '$name';
begin isolation level repeatable read;
select state from setupsheet_storage_private.objects
where path = '73000000-0000-4000-8000-000000000002/${rr_file}';
select pg_sleep(2);
insert into public.setups(user_id,game,car,track,condition,description,tags,rig_profile,file_path,file_name)
values ('73000000-0000-4000-8000-000000000002','iRacing','Test','Test','Dry','race','{}','Gamepad',
 '73000000-0000-4000-8000-000000000002/${rr_file}','${rr_file}');
commit;
SQL
first=$!
wait_for_sleep "$name"
claim=$(q -c "select public.claim_storage_cleanup('73000000-0000-4000-8000-000000000002/${rr_file}')")
[[ -n "$claim" ]]
if wait "$first"; then echo 'Stale snapshot attached a claimed object' >&2; exit 1; fi
if ! grep -q 'could not serialize access' "$work_dir/repeatable-read"; then cat "$work_dir/repeatable-read" >&2; exit 1; fi

done

echo 'Storage concurrency passed: one-use ticket; one final quota slot; attachment/cleanup exclusion; existing/missing-row stale snapshots fail closed.' 
