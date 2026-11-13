#!/usr/bin/env bash
# Verify an encrypted dump and restore only to an explicitly approved local scratch database.
# Does not connect to a remote host and never writes plaintext backup bytes to disk.
set -euo pipefail
umask 077
for tool in age pg_restore psql; do command -v "$tool" >/dev/null || { echo "Missing $tool" >&2; exit 1; }; done
for key in SETUPSHEET_BACKUP_FILE AGE_IDENTITY_FILE RESTORE_PGHOST RESTORE_PGUSER RESTORE_PGDATABASE; do
  if [[ -z "${!key:-}" ]]; then echo "Missing $key" >&2; exit 1; fi
done
[[ -s "$SETUPSHEET_BACKUP_FILE" && -r "$SETUPSHEET_BACKUP_FILE" && -r "$AGE_IDENTITY_FILE" ]] || { echo "Missing backup or decryption identity" >&2; exit 1; }
case "$RESTORE_PGHOST" in localhost|127.0.0.1|::1) ;; *) echo "Refusing non-loopback restore host" >&2; exit 1;; esac
[[ "$RESTORE_PGDATABASE" =~ ^setupsheet_restore_[a-zA-Z0-9_]+$ ]] || { echo "Restore database name must start with setupsheet_restore_" >&2; exit 1; }
[[ "${RESTORE_CONFIRM_ISOLATED:-}" == RESTORE_TO_DISPOSABLE_LOCAL_DB ]] || { echo "Explicit isolated-restore confirmation missing" >&2; exit 1; }
export PGHOST="$RESTORE_PGHOST" PGPORT="${RESTORE_PGPORT:-5432}" PGUSER="$RESTORE_PGUSER" PGDATABASE="$RESTORE_PGDATABASE" PGSSLMODE="${RESTORE_PGSSLMODE:-prefer}"
if [[ -n "${RESTORE_PGPASSWORD:-}" ]]; then export PGPASSWORD="$RESTORE_PGPASSWORD"; fi
if [[ -n "${RESTORE_PGPASSFILE:-}" ]]; then export PGPASSFILE="$RESTORE_PGPASSFILE"; fi
psql -XAtq -v ON_ERROR_STOP=1 -c "select current_database()" >/dev/null
echo "Checking encrypted archive is readable..."
age --decrypt --identity "$AGE_IDENTITY_FILE" "$SETUPSHEET_BACKUP_FILE" | pg_restore --list - >/dev/null
echo "Restoring into disposable loopback database only..."
age --decrypt --identity "$AGE_IDENTITY_FILE" "$SETUPSHEET_BACKUP_FILE" | pg_restore --dbname="$RESTORE_PGDATABASE" --no-owner --no-acl --exit-on-error --single-transaction -
echo "Checking required restored relations..."
for relation in public.setups public.profiles auth.users storage.objects supabase_migrations.schema_migrations; do
  result="$(psql -XAtq -v ON_ERROR_STOP=1 -c "SELECT to_regclass('$relation') is not null")"
  [[ "$result" == "t" ]] || { echo "Missing restored relation: $relation" >&2; exit 1; }
  count="$(psql -XAtq -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM $relation")"
  echo "$relation: $count restored rows"
done
echo "Restored database passed minimal schema checks in a disposable local target."
echo "NOT YET COMPLETE: compare source/target counts, verify OAuth/configuration and Storage object bytes."
