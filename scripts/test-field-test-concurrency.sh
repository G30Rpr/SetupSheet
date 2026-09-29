#!/usr/bin/env bash
# Exercises the field-test UTC-day uniqueness invariant with two independent
# authenticated PostgreSQL connections. Run by test-db.sh after its shared
# garage_rls.test.sql fixture has been applied.
set -euo pipefail

DB_NAME="${1:?Usage: test-field-test-concurrency.sh <database-name>}"
REPORTER_ID="11111111-1111-4111-8111-111111111111"
SETUP_ID="77777777-7777-4777-8777-777777777777"
SESSION_ID="12121212-1212-4121-8121-121212121212"

TMP_DIR=$(mktemp -d)
cleanup() {
  if [[ -n "${PID_ONE:-}" ]]; then kill "$PID_ONE" 2>/dev/null || true; fi
  if [[ -n "${PID_TWO:-}" ]]; then kill "$PID_TWO" 2>/dev/null || true; fi
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
    "drop trigger if exists test_delay_field_test_report_insert on public.field_test_reports;" >/dev/null 2>&1 || true
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
    "drop function if exists public.test_delay_field_test_report_insert();" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# Earlier SQL regression files pin auth.uid() to their own test user. Restore
# the JWT-claim implementation used by the Supabase role/RLS harness.
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- Hold each insert inside the same critical window so both RPCs attempt the
-- unique key concurrently instead of relying on scheduler timing alone.
create or replace function public.test_delay_field_test_report_insert()
returns trigger
language plpgsql
as $$
begin
  perform pg_sleep(0.75);
  return new;
end;
$$;
create trigger test_delay_field_test_report_insert
  before insert on public.field_test_reports
  for each row execute function public.test_delay_field_test_report_insert();
SQL

run_create() {
  local note="$1"
  psql -X -q -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '$REPORTER_ID', true);
select public.create_field_test_report('$SESSION_ID', '$SETUP_ID', '$note');
commit;
SQL
}

run_create "concurrent field test one" >"$TMP_DIR/one.out" 2>"$TMP_DIR/one.err" &
PID_ONE=$!
run_create "concurrent field test two" >"$TMP_DIR/two.out" 2>"$TMP_DIR/two.err" &
PID_TWO=$!

set +e
wait "$PID_ONE"
STATUS_ONE=$?
wait "$PID_TWO"
STATUS_TWO=$?
set -e
PID_ONE=""
PID_TWO=""

if [[ $STATUS_ONE -eq 0 && $STATUS_TWO -ne 0 ]]; then
  WINNER=one
  LOSER=two
elif [[ $STATUS_TWO -eq 0 && $STATUS_ONE -ne 0 ]]; then
  WINNER=two
  LOSER=one
else
  echo "Expected exactly one concurrent field-test create to succeed; exit statuses were $STATUS_ONE and $STATUS_TWO." >&2
  cat "$TMP_DIR/one.err" "$TMP_DIR/two.err" >&2
  exit 1
fi

if ! grep -q "duplicate key value violates unique constraint" "$TMP_DIR/$LOSER.err"; then
  echo "The losing concurrent create failed for an unexpected reason:" >&2
  cat "$TMP_DIR/$LOSER.err" >&2
  exit 1
fi

REPORT_COUNT=$(psql -X -q -tA -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
  "select count(*) from public.field_test_reports where user_id = '$REPORTER_ID' and setup_id = '$SETUP_ID' and report_day_utc = (now() at time zone 'UTC')::date;")
if [[ "$REPORT_COUNT" != "1" ]]; then
  echo "Expected one report for the UTC day after concurrent creation; found $REPORT_COUNT." >&2
  exit 1
fi

echo "Concurrent field-test create passed (winner: $WINNER; loser rejected by the UTC-day unique constraint)."
