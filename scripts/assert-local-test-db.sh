#!/usr/bin/env bash
# Shared guard for scripts that create/drop databases or mutate SQL fixtures.
# Source this file and call before installing cleanup traps or invoking psql.
assert_local_test_db() {
  local database_name="${1:-}"
  if ! [[ "$database_name" =~ ^setupsheet_migration_test_[0-9]+$ ]]; then
    echo "Refusing to run outside the migration test database." >&2
    return 1
  fi

  export PGHOST="${PGHOST:-localhost}"
  export PGPORT="${PGPORT:-5432}"
  export PGUSER="${PGUSER:-postgres}"
  case "$PGHOST" in localhost|127.0.0.1|::1) ;; *)
    echo "Refusing destructive database tests on non-loopback PGHOST." >&2
    return 1 ;;
  esac
  if [[ -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" || -n "${PGSERVICEFILE:-}" ]]; then
    echo "Refusing libpq hostaddr/service overrides during destructive tests." >&2
    return 1
  fi
  if ! [[ "$PGPORT" =~ ^[0-9]{1,5}$ ]] || (( 10#$PGPORT < 1 || 10#$PGPORT > 65535 )); then
    echo "Refusing an invalid PostgreSQL test port." >&2
    return 1
  fi
  # Verify the client destination, not inet_server_addr(): Docker may forward
  # a valid localhost connection onto a non-loopback container interface.
}
