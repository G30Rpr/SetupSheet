#!/usr/bin/env bash
# Regression test for the SQL migrations under supabase/migrations/ --
# applies every migration to a scratch Postgres database (created fresh and
# dropped at the end, so this is safe to re-run against a shared local
# Postgres instance) and then runs the assertions in
# supabase/testing/*.test.sql. Exits non-zero if any migration fails to
# apply or any assertion fails.
#
# Connection is via the standard PG* environment variables (PGHOST, PGPORT,
# PGUSER, PGPASSWORD, ...) -- defaults below match a local Postgres running
# as the `postgres` superuser; override them to point at a CI service
# container or a different local setup.
set -euo pipefail

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"

cd "$(dirname "$0")/.."

DB_NAME="setupsheet_migration_test_$$"

cleanup() {
  psql -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" >/dev/null
}
trap cleanup EXIT

psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$DB_NAME\";" >/dev/null
echo "Created scratch database $DB_NAME"

psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f supabase/testing/shim.sql >/dev/null

for migration in supabase/migrations/*.sql; do
  echo "Applying $migration"
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done

for test_file in supabase/testing/*.test.sql; do
  echo "Running $test_file"
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$test_file"
done

echo "All migrations and regression checks passed."
