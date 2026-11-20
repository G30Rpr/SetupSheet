#!/usr/bin/env bash
# Two independent authenticated claims must produce one winner/notification.
# This mutating test is only for the disposable database created by test-db.sh.
set -euo pipefail
DB_NAME="${1:?Usage: test-fulfillment-concurrency.sh <scratch-database>}"
if ! [[ "$DB_NAME" =~ ^setupsheet_migration_test_[0-9]+$ ]]; then
  echo "Refusing to run outside the migration test database." >&2
  exit 1
fi
# This helper mutates fixtures and can run standalone, so repeat the endpoint
# guard rather than trusting the caller's scratch-looking database name.
case "${PGHOST:-localhost}" in localhost|127.0.0.1|::1) ;; *)
  echo "Refusing concurrency test on non-loopback PGHOST" >&2; exit 1 ;;
esac
if [[ -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" || -n "${PGSERVICEFILE:-}" ]]; then
  echo "Refusing libpq hostaddr/service overrides" >&2; exit 1
fi
server_addr="$(psql -XAtq -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c "select coalesce(inet_server_addr()::text, 'socket')")"
case "$server_addr" in 127.0.0.1|::1) ;; *)
  echo "Refusing concurrency test against non-loopback PostgreSQL" >&2; exit 1 ;;
esac
TMP_DIR=$(mktemp -d)
cleanup() {
  if [[ -n "${PID_ONE:-}" ]]; then kill "$PID_ONE" 2>/dev/null || true; fi
  if [[ -n "${PID_TWO:-}" ]]; then kill "$PID_TWO" 2>/dev/null || true; fi
  psql -X -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null 2>&1 || true
drop trigger if exists test_delay_request_claim on public.setup_requests;
drop function if exists public.test_delay_request_claim();
delete from auth.users where id in
  ('f4444444-4444-4444-8444-444444444444','f5555555-5555-4555-8555-555555555555');
SQL
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

psql -X -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
insert into auth.users(id,email) values
  ('f4444444-4444-4444-8444-444444444444','concurrent-owner@example.test'),
  ('f5555555-5555-4555-8555-555555555555','concurrent-requester@example.test');
insert into public.setup_requests(id,requester_id,game,car,track,notes) values
  ('a4444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f5555555-5555-4555-8555-555555555555',
   'iRacing','Porsche 992 GT3 Cup','Spa-Francorchamps','concurrent claim');
insert into public.setups(id,user_id,game,car,track,condition,description,tags,rig_profile) values
  ('c4444444-cccc-4ccc-8ccc-cccccccccccc','f4444444-4444-4444-8444-444444444444','iRacing','Porsche 992 GT3 Cup','Spa-Francorchamps','Dry','first candidate','{}','Gamepad'),
  ('c5555555-cccc-4ccc-8ccc-cccccccccccc','f4444444-4444-4444-8444-444444444444','iRacing','Porsche 992 GT3 Cup','Spa-Francorchamps','Wet','second candidate','{}','Gamepad');
-- Keep the winning update in flight while the competing connection claims.
create function public.test_delay_request_claim() returns trigger language plpgsql as $$
begin perform pg_sleep(0.75); return new; end;
$$;
create trigger test_delay_request_claim before update of fulfilled_setup_id
  on public.setup_requests for each row execute function public.test_delay_request_claim();
SQL

run_claim() {
  psql -X -q -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
begin;
set local statement_timeout = '15s';
set local role authenticated;
select set_config('request.jwt.claim.sub','f4444444-4444-4444-8444-444444444444',true);
select public.fulfill_setup_request('a4444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa','$1');
commit;
SQL
}
run_claim 'c4444444-cccc-4ccc-8ccc-cccccccccccc' >"$TMP_DIR/one.out" 2>"$TMP_DIR/one.err" &
PID_ONE=$!
run_claim 'c5555555-cccc-4ccc-8ccc-cccccccccccc' >"$TMP_DIR/two.out" 2>"$TMP_DIR/two.err" &
PID_TWO=$!
set +e
wait "$PID_ONE"; STATUS_ONE=$?
wait "$PID_TWO"; STATUS_TWO=$?
set -e
PID_ONE=""; PID_TWO=""
if [[ "$STATUS_ONE" -eq 0 && "$STATUS_TWO" -ne 0 ]]; then
  WINNER='c4444444-cccc-4ccc-8ccc-cccccccccccc'; LOSER=two
elif [[ "$STATUS_TWO" -eq 0 && "$STATUS_ONE" -ne 0 ]]; then
  WINNER='c5555555-cccc-4ccc-8ccc-cccccccccccc'; LOSER=one
else
  echo "Expected one winning claim; statuses were $STATUS_ONE/$STATUS_TWO." >&2
  cat "$TMP_DIR/one.err" "$TMP_DIR/two.err" >&2
  exit 1
fi
if ! grep -q 'This request has already been fulfilled' "$TMP_DIR/$LOSER.err"; then
  cat "$TMP_DIR/$LOSER.err" >&2
  exit 1
fi
result=$(psql -X -qAt -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
  select (select fulfilled_setup_id = '$WINNER'::uuid
                 and fulfilled_by = 'f4444444-4444-4444-8444-444444444444'::uuid
                 and fulfilled_at is not null
          from public.setup_requests where id='a4444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    and (select count(*)=1 and bool_and(setup_id='$WINNER'::uuid)
         from public.notifications where type='request_fulfilled'
           and actor_id='f4444444-4444-4444-8444-444444444444'
           and user_id='f5555555-5555-4555-8555-555555555555');")
if [[ "$result" != t ]]; then
  echo "Winning claim and notification do not match." >&2
  exit 1
fi
echo "Concurrent fulfillment passed: one claim, one matching notification."
