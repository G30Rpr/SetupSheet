#!/usr/bin/env bash
# Regression test for the SQL migrations under supabase/migrations/ --
# applies every migration to a scratch Postgres database (created fresh and
# dropped at the end, so this is safe to re-run against a shared local
# Postgres instance), runs the assertions in supabase/testing/*.test.sql, and
# finishes with a real two-connection field-test uniqueness race. Exits
# non-zero if any migration or assertion fails.
#
# Connection is via the standard PG* environment variables (PGHOST, PGPORT,
# PGUSER, PGPASSWORD, ...) -- defaults below match a local Postgres running
# as the `postgres` superuser; override them to point at a CI service
# container. Remote Postgres hosts are refused because this test creates and
# drops a database and runs destructive fixtures.
set -euo pipefail

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"

# A scratch database name is not enough: fail closed on non-local targets
# and on alternate libpq connection selectors that bypass PGHOST.
case "$PGHOST" in localhost|127.0.0.1|::1) ;; *)
  echo "Refusing migration tests on non-loopback PGHOST" >&2; exit 1 ;;
esac
if [[ -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" || -n "${PGSERVICEFILE:-}" ]]; then
  echo "Refusing libpq hostaddr/service overrides during destructive tests" >&2
  exit 1
fi
# Check the actual server endpoint before CREATE/DROP DATABASE.
server_addr="$(psql -XAtq -d postgres -v ON_ERROR_STOP=1 \
  -c 'select coalesce(inet_server_addr()::text, \'socket\')')"
case "$server_addr" in 127.0.0.1|::1) ;; *)
  echo "Refusing migration tests against a non-loopback PostgreSQL endpoint" >&2
  exit 1 ;;
esac

cd "$(dirname "$0")/.."

DB_NAME="setupsheet_migration_test_$$"

cleanup() {
  psql -X -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" >/dev/null
}
trap cleanup EXIT

psql -X -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$DB_NAME\";" >/dev/null
echo "Created scratch database $DB_NAME"

psql -X -d "$DB_NAME" -v ON_ERROR_STOP=1 -f supabase/testing/shim.sql >/dev/null

# Supabase migration versions are the numeric filename prefix, not the full
# filename. Two files with the same prefix can appear to work in this raw
# psql harness while the Supabase migration runner rejects the duplicate (or
# applies an unpredictable one first), so fail early and explicitly.
duplicate_versions=$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\n' \
  | sed -n 's/^\([0-9][0-9]*\)_.*/\1/p' \
  | sort | uniq -d)
if [[ -n "$duplicate_versions" ]]; then
  echo "Duplicate migration version(s): $duplicate_versions" >&2
  for version in $duplicate_versions; do
    echo "Conflicting files for $version:" >&2
    find supabase/migrations -maxdepth 1 -type f -name "${version}_*.sql" -printf '  %f\\n' | sort >&2
  done
  exit 1
fi

# Versions before 0041 are historical and may contain explicit transactions.
for migration in supabase/migrations/*.sql; do
  version=${migration##*/}
  version=${version%%_*}
  if (( 10#$version >= 41 )) && grep -qiE '^[[:space:]]*(begin|commit)[[:space:]]*;' "$migration"; then
    echo "Migration must use the deployment runner transaction: $migration" >&2
    exit 1
  fi
done

for migration in supabase/migrations/*.sql; do
  echo "Applying $migration"
  psql -X -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done

for test_file in supabase/testing/*.test.sql; do
  echo "Running $test_file"
  psql -X -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$test_file"
done

bash scripts/test-field-test-concurrency.sh "$DB_NAME"
bash scripts/test-fulfillment-concurrency.sh "$DB_NAME"

echo "All migrations and regression checks passed."
