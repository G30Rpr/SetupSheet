#!/usr/bin/env bash
# Inventory is read-only. Applying requires a separate, explicit release job.
set -euo pipefail

mode="${1:---dry-run}"
if [[ "$mode" != "--dry-run" && "$mode" != "--apply" ]]; then
  echo "Usage: bash scripts/deploy-migrations.sh [--dry-run|--apply]" >&2
  exit 1
fi
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
cd "$(dirname "$0")/.."

# Never bootstrap a production history table as a side effect of inspection.
# -X ignores operator psqlrc files; every inventory query is read-only.
read_sql() {
  psql "$SUPABASE_DB_URL" -XqAt -v ON_ERROR_STOP=1 \
    -c "begin read only; $1; commit;"
}

history_exists=$(read_sql "select to_regclass('supabase_migrations.schema_migrations') is not null")
applied=""
if [[ "$history_exists" == "t" ]]; then
  applied=$(read_sql "select version from supabase_migrations.schema_migrations order by version")
elif [[ "$mode" == "--apply" ]]; then
  echo "Migration history is missing; refusing to replay migrations. Reconcile the target first." >&2
  exit 1
fi

pending=()
versions=()
for file in supabase/migrations/*.sql; do
  base="$(basename "$file")"
  # Preserve legacy four-digit versions and accept CLI-generated timestamps.
  if ! [[ "$base" =~ ^([0-9]{4}|[0-9]{14})_[a-z0-9_]+\.sql$ ]]; then
    echo "Invalid migration filename: $file" >&2
    exit 1
  fi
  version="${base%%_*}"
  for seen in "${versions[@]}"; do
    if [[ "$seen" == "$version" ]]; then
      echo "Duplicate migration version: $version" >&2
      exit 1
    fi
  done
  versions+=("$version")
  if ! grep -Fxq "$version" <<< "$applied"; then
    pending+=("$file")
  fi
done

if [[ "$mode" == "--dry-run" ]]; then
  echo "Read-only inventory — pending migrations:"
  if [[ "$history_exists" != "t" ]]; then
    echo "History table is absent; all local migrations are listed. Apply will refuse this target."
  fi
  if [[ "${#pending[@]}" -eq 0 ]]; then echo "  (none)"; fi
  for file in "${pending[@]}"; do echo "  $file"; done
  exit 0
fi

# Check the entire batch before applying any file. Historical transactions
# require explicit reconciliation rather than silently committing mid-file.
for file in "${pending[@]}"; do
  if grep -qiE '^[[:space:]]*(begin|commit)[[:space:]]*;' "$file"; then
    echo "Pending migration contains BEGIN/COMMIT: $file" >&2
    exit 1
  fi
done

for file in "${pending[@]}"; do
  base="$(basename "$file" .sql)"
  version="${base%%_*}"
  echo "Apply $base"
  psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 --single-transaction \
    -f "$file" \
    -c "insert into supabase_migrations.schema_migrations (version, name, created_by) values ('$version', '$base', 'github-actions deploy-migrations')"
done
echo "Applied ${#pending[@]} migration(s)."
