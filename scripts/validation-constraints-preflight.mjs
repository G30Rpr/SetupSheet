import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// The immutable forward migration is the single reviewed source for these
// definitions. This command prints read-only SQL and never reads credentials.
const migration = readFileSync(new URL(
  "../supabase/migrations/20261116211420_reconcile_validation_constraints.sql",
  import.meta.url
), "utf8");
const manifest = migration.match(/\$checks\$([\s\S]*?)\$checks\$/);
if (!manifest) throw new Error("Validation constraint manifest is missing");
export const validationChecks = JSON.parse(manifest[1]);

const literal = (value) => `'${value.replaceAll("'", "''")}'`;
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;

export function buildValidationPreflight() {
  const queries = validationChecks.map(({ table_name: table, name, expression }) => `
    select ${literal(`public.${table}`)} as table_name, ${literal(name)} as constraint_name,
      c.oid is not null as present,
      row_security_active(${literal(`public.${table}`)}::regclass) as rls_filtering_active,
      coalesce(c.contype = 'c' and pg_get_expr(c.conbin,c.conrelid,false) = ${literal(expression)},false) as definition_matches,
      coalesce(c.convalidated,false) as validated,
      (select count(*) from public.${identifier(table)} where (${expression}) is false) as violating_rows
    from (select 1) anchor
    left join pg_constraint c on c.conrelid = ${literal(`public.${table}`)}::regclass
      and c.conname = ${literal(name)}`);
  return `begin read only;
set local search_path = pg_catalog, public;
set local standard_conforming_strings = on;
select json_agg(report order by report.table_name,report.constraint_name) as validation_preflight
from (${queries.join("\nunion all\n")}) report;
commit;\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(buildValidationPreflight());
}
