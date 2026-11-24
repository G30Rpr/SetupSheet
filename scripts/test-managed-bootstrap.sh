#!/usr/bin/env bash
# Dedicated plain loopback PostgreSQL instance only. Never a hosted target.
set -euo pipefail
cd "$(dirname "$0")/.."
if (( $# )); then
  echo "Usage: bash scripts/test-managed-bootstrap.sh" >&2
  exit 1
fi

DB_NAME="setupsheet_migration_test_$$"
managed_role="setupsheet_managed_$$"
source scripts/assert-local-test-db.sh
assert_local_test_db "$DB_NAME"
if [[ -n "${PGOPTIONS:-}" ]]; then
  echo "Refusing PGOPTIONS overrides during the managed-operator test." >&2
  exit 1
fi

# The fixture administrator creates an isolated role/database. Every shim and
# migration statement then runs with a non-superuser current_user.
ready=$(psql -XqAt -d postgres -v ON_ERROR_STOP=1 -c \
  "select (select rolsuper from pg_roles where rolname=current_user) and current_setting('server_version_num')::int>=160000 and not exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role','setupsheet_garage_writer','$managed_role')) and not exists(select 1 from pg_database where datname='$DB_NAME')")
if [[ "$ready" != "t" ]]; then
  echo "Requires a dedicated PostgreSQL 16+ fixture with no Supabase API/writer roles." >&2
  exit 1
fi

temporary_dir=$(mktemp -d)
fixture_created=false
cleanup() {
  result=$?
  trap - EXIT
  if [[ "$fixture_created" == true ]]; then
    if ! psql -X -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" \
      -c "DROP ROLE IF EXISTS setupsheet_garage_writer, anon, authenticated, service_role, \"$managed_role\";" >/dev/null; then
      result=1
    fi
  fi
  rm -rf -- "$temporary_dir"
  exit "$result"
}
trap cleanup EXIT

psql -X -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE \"$managed_role\" NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS;" >/dev/null
fixture_created=true
psql -X -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$managed_role\";" >/dev/null
psql -X -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c "ALTER SCHEMA public OWNER TO \"$managed_role\";" >/dev/null
psql -X -d "$DB_NAME" -v ON_ERROR_STOP=1 --single-transaction \
  -c "SET ROLE \"$managed_role\";" -f supabase/testing/shim.sql >/dev/null

for migration in supabase/migrations/*.sql; do
  echo "Managed bootstrap: $migration"
  node scripts/prepare-managed-bootstrap.mjs --operator "$managed_role" --sql "$migration" > "$temporary_dir/migration.sql"
  if ! psql -X -d "$DB_NAME" -v ON_ERROR_STOP=1 --single-transaction \
    -c "SET ROLE \"$managed_role\";" -f "$temporary_dir/migration.sql" \
    > /dev/null 2> "$temporary_dir/diagnostics"; then
    cat "$temporary_dir/diagnostics" >&2
    exit 1
  fi
  if grep -Eq 'WARNING:.*(no privileges|not all privileges)' "$temporary_dir/diagnostics"; then
    cat "$temporary_dir/diagnostics" >&2
    echo "Managed bootstrap produced ineffective privilege statements." >&2
    exit 1
  fi
  if [[ "${migration##*/}" == "0030_garage_private_workflow.sql" ]]; then
    # Reproduce the partial hosted bootstrap's warning-only ACL drift. The next
    # non-superuser transaction must repair it, not merely work on a fresh ACL.
    psql -X -d "$DB_NAME" -v ON_ERROR_STOP=1 \
      -c "GRANT EXECUTE ON FUNCTION public.create_garage_session_with_baseline(text,text,text,text,text,jsonb,text) TO PUBLIC;" >/dev/null
  fi
done

psql -X -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c "SET ROLE \"$managed_role\";" -f supabase/testing/managed-bootstrap-postflight.sql
echo "Managed bootstrap and owner-scoped Garage checks passed."
