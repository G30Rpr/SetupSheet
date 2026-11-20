#!/usr/bin/env bash
# Integration tests for missing/conflicting constraints and incompatible data.
set -euo pipefail
DB_NAME="${1:?Usage: test-validation-constraint-drift.sh <scratch-database>}"
source "$(dirname "${BASH_SOURCE[0]}")/assert-local-test-db.sh"
assert_local_test_db "$DB_NAME"
cd "$(dirname "$0")/.."
MIGRATION=supabase/migrations/20261116211420_reconcile_validation_constraints.sql
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
query() { psql -XqAt -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "$1"; }
apply_repair() {
  psql -X -d "$DB_NAME" -v ON_ERROR_STOP=1 --single-transaction -f "$MIGRATION"
}
preflight() {
  node scripts/validation-constraints-preflight.mjs |
    psql -XqAt -d "$DB_NAME" -v ON_ERROR_STOP=1 > "$TMP_DIR/preflight.json"
}

query 'alter table public.profiles validate constraint profiles_username_length_check' >/dev/null
apply_repair > "$TMP_DIR/apply.log"
[[ $(query "select convalidated from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_username_length_check'") == t ]]

# Drop only the reviewed check constraints in this disposable fixture database.
node --input-type=module <<'JS' | psql -Xq -d "$DB_NAME" -v ON_ERROR_STOP=1
import { validationChecks } from "./scripts/validation-constraints-preflight.mjs";
for (const c of validationChecks) {
  console.log(`alter table public.${c.table_name} drop constraint ${c.name};`);
}
JS
psql -Xq -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id,email) values
  ('a7777777-7777-4777-8777-777777777777','historical-validation@example.test');
insert into public.setups(id,user_id,game,car,track,condition,description,rig_profile) values
  ('b7777777-7777-4777-8777-777777777777','a7777777-7777-4777-8777-777777777777',
   'iRacing','Porsche 992 GT3 Cup','Spa-Francorchamps','Dry',repeat('x',2001),'Gamepad');
SQL
preflight
node --input-type=module - "$TMP_DIR/preflight.json" <<'JS'
import { readFileSync } from "node:fs";
const rows = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (rows.length !== 22 || rows.some(r => r.present || r.rls_filtering_active) ||
    rows.find(r => r.constraint_name === "setups_description_length_check").violating_rows !== 1) {
  throw new Error("Read-only preflight did not identify the missing checks and incompatible fixture");
}
JS
if apply_repair > "$TMP_DIR/bad-data.log" 2>&1; then
  echo "Repair accepted incompatible historical data." >&2; exit 1
fi
grep -q 'Existing rows violate' "$TMP_DIR/bad-data.log"
# Earlier ADDs must roll back with the failed file, leaving every check absent.
preflight
node --input-type=module - "$TMP_DIR/preflight.json" <<'JS'
import { readFileSync } from "node:fs";
if (JSON.parse(readFileSync(process.argv[2], "utf8")).some(r => r.present)) {
  throw new Error("Failed repair left partial constraint changes");
}
JS
[[ $(query "select char_length(description) from public.setups where id='b7777777-7777-4777-8777-777777777777'") == 2001 ]]
query "delete from auth.users where id='a7777777-7777-4777-8777-777777777777'" >/dev/null

# A matching name is insufficient: a weakened definition must block release.
query 'alter table public.profiles add constraint profiles_username_length_check check (true)' >/dev/null
if apply_repair > "$TMP_DIR/wrong-definition.log" 2>&1; then
  echo "Repair accepted a conflicting constraint definition." >&2; exit 1
fi
grep -q 'Definition mismatch' "$TMP_DIR/wrong-definition.log"
query 'alter table public.profiles drop constraint profiles_username_length_check' >/dev/null
apply_repair > "$TMP_DIR/apply.log"
apply_repair >> "$TMP_DIR/apply.log"
preflight
node --input-type=module - "$TMP_DIR/preflight.json" <<'JS'
import { readFileSync } from "node:fs";
const rows = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (rows.length !== 22 || rows.some(r => !r.present || !r.definition_matches || r.rls_filtering_active || r.violating_rows !== 0)) {
  throw new Error("Repair did not restore all reviewed checks");
}
JS

# The report must flag a restricted API role rather than presenting its counts
# as an operator-wide readiness check. BEGIN inside the already-open read-only
# transaction is harmless; the local role remains active for the generated SQL.
{ printf 'begin read only; set local role authenticated;\n'; node scripts/validation-constraints-preflight.mjs; } |
  psql -XqAt -d "$DB_NAME" -v ON_ERROR_STOP=1 > "$TMP_DIR/restricted.json"
node --input-type=module - "$TMP_DIR/restricted.json" <<'JS'
import { readFileSync } from "node:fs";
const rows = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (rows.length !== 22 || rows.some(r => !r.rls_filtering_active)) {
  throw new Error("Preflight did not warn about API-role RLS visibility");
}
JS
echo "Validation drift repair passed: 22 checks restored, conflicts/data rejected, failed file rolled back."
