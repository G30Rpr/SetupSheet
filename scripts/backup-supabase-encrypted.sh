#!/usr/bin/env bash
# Operator-only encrypted Supabase logical backup.
# Read-only against the database. Never checks in or uploads backup bytes.
# Requires PostgreSQL pg_dump, age, an age public recipient and a database
# credential with sufficient permissions for the selected schemas.
set -euo pipefail
umask 077

for tool in pg_dump psql age; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Missing required command: $tool" >&2; exit 1; }
done

for key in PGHOST PGUSER PGDATABASE AGE_RECIPIENT SETUPSHEET_BACKUP_DIR; do
  if [[ -z "${!key:-}" ]]; then
    echo "Required environment variable is missing: $key" >&2
    exit 1
  fi
done

# Never print a connection string, password, or credentials.
: "${PGPORT:=5432}"
: "${PGSSLMODE:=require}"
export PGPORT PGSSLMODE

case "$SETUPSHEET_BACKUP_DIR" in
  /*) ;;
  *) echo "SETUPSHEET_BACKUP_DIR must be an absolute path" >&2; exit 1;;
esac

mkdir -p -- "$SETUPSHEET_BACKUP_DIR"
dest="$SETUPSHEET_BACKUP_DIR/setupsheet-db-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
if [[ -e "$dest" ]]; then echo "Backup filename already exists" >&2; exit 1; fi

# Only ciphertext is ever written to disk. pipefail fails the whole backup if
# pg_dump fails; trap removes partial ciphertext on any unsuccessful exit.
ok=false
cleanup() {
  if [[ "$ok" != true ]]; then rm -f -- "$dest"; fi
}
trap cleanup EXIT

echo "Creating an encrypted backup of public, auth, and Storage metadata..."
# Capture migration history as well as the application and managed data.
# A post-deployment app_private schema may exist; include it when available.
schemas=(--schema=public --schema=auth --schema=storage --schema=supabase_migrations)
if [[ "$(psql -XAtq -v ON_ERROR_STOP=1 -c "select count(*) from pg_namespace where nspname='app_private'")" == "1" ]]; then
  schemas+=(--schema=app_private)
fi
pg_dump --format=custom --no-owner --no-acl "${schemas[@]}" --file=- \
  | age --recipient "$AGE_RECIPIENT" --output "$dest"

if [[ ! -s "$dest" ]]; then
  echo "Backup output is empty" >&2
  exit 1
fi

ok=true
trap - EXIT
echo "Encrypted backup saved to operator-controlled directory:"
echo "$dest"
echo "NOT VERIFIED: restore this backup in an isolated environment before approving production migrations."
echo "Storage object contents must be backed up separately via the Storage API."
