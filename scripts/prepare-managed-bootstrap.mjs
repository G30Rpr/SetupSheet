import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const writer = "setupsheet_garage_writer";
const transactionFiles = new Set([
  "0031_garage_start_from_setup.sql",
  "0032_field_test_reports.sql",
  "0033_engineer_public_calibration.sql",
  "0040_saved_rig_profiles.sql",
]);
const ownershipFiles = new Set([
  "0031_garage_start_from_setup.sql",
  "0032_field_test_reports.sql",
]);
const restrictiveFlags =
  "not (rolcanlogin or rolinherit or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)";
const hash = (text) => createHash("sha256").update(text).digest("hex");

function writerInvariant(operator) {
  return `do $managed_writer_postflight$ begin
 if not exists(select 1 from pg_roles where rolname='${writer}' and ${restrictiveFlags})
 or has_schema_privilege('${writer}','public','CREATE')
 or pg_has_role('${operator}','${writer}','USAGE')
 or pg_has_role('anon','${writer}','MEMBER')
 or pg_has_role('authenticated','${writer}','MEMBER') then
  raise exception 'Unexpected managed writer attributes, memberships or schema privileges';
 end if;
end $managed_writer_postflight$;
`;
}

function garageExecutionInvariant() {
  return `do $managed_garage_execute$ begin
 if has_function_privilege('anon','public.create_garage_session_with_baseline(text,text,text,text,text,jsonb,text)','EXECUTE')
 or not has_function_privilege('authenticated','public.create_garage_session_with_baseline(text,text,text,text,text,jsonb,text)','EXECUTE')
 or not exists(select 1 from pg_proc where oid='public.create_garage_session_with_baseline(text,text,text,text,text,jsonb,text)'::regprocedure
 and proowner='${writer}'::regrole and prosecdef) then
  raise exception 'Unexpected Garage execution privileges or owner';
 end if;
end $managed_garage_execute$;
`;
}

/** Prepare one cold-bootstrap transaction body. No database/network access. */
export function prepareManagedBootstrap({ fileName, sourceSql, operator }) {
  if (!/^(?:[0-9]{4}|[0-9]{14})_[a-z0-9_]+\.sql$/.test(fileName ?? "")) {
    throw new Error("Expected a source migration basename");
  }
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(operator ?? "")) {
    throw new Error("An explicit simple PostgreSQL operator name is required");
  }
  if (typeof sourceSql !== "string" || !sourceSql.trim()) {
    throw new Error("Expected nonempty source SQL");
  }
  const version = BigInt(fileName.split("_")[0]);
  const adaptations = [];
  let core = sourceSql;
  const boundaries = [...core.matchAll(/^[\t ]*(begin|commit);[\t ]*$/gim)];
  if (boundaries.length) {
    if (
      !transactionFiles.has(fileName) ||
      boundaries.length !== 2 ||
      boundaries[0][1].toLowerCase() !== "begin" ||
      boundaries[1][1].toLowerCase() !== "commit"
    ) {
      throw new Error("Unreviewed transaction boundaries");
    }
    core = core.replace(
      /^[\t ]*(?:begin|commit);[\t ]*$/gim,
      "-- Transaction owned by the cold-bootstrap runner.",
    );
    adaptations.push("outer transaction supplied by runner");
  }
  if (fileName === "0005_remove_f1_24.sql") {
    const deletion = "delete from public.setups where game = 'F1 24';";
    if (core.split(deletion).length !== 2) {
      throw new Error("Legacy game migration changed; review its adapter");
    }
    core = core.replace(
      deletion,
      `lock table public.setups in access exclusive mode;
do $managed_empty_game$ begin
 if exists(select 1 from public.setups where game='F1 24') then
  raise exception 'Cold bootstrap refuses to delete setup data';
 end if;
end $managed_empty_game$;`,
    );
    adaptations.push("locked empty-game assertion replaces legacy deletion");
  }
  let prefix = `set local lock_timeout='5s';
do $managed_empty_bootstrap$ begin
 if current_user<>'${operator}' or (select rolsuper from pg_roles where rolname=current_user) then
  raise exception 'Expected the reviewed non-superuser operator';
 end if;
 if exists(select 1 from auth.users) or exists(select 1 from storage.objects) then
  raise exception 'Cold bootstrap requires an empty Auth/Storage target';
 end if;
end $managed_empty_bootstrap$;
`;
  if (fileName === "0030_garage_private_workflow.sql") {
    const alteration = `alter role ${writer}\n  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;`;
    if (core.split(alteration).length !== 2) {
      throw new Error("Garage role migration changed; review its adapter");
    }
    prefix += `set local createrole_self_grant='set';
do $managed_new_writer$ begin
 if exists(select 1 from pg_roles where rolname='${writer}') then
  raise exception 'Cold bootstrap requires a new Garage writer role';
 end if;
end $managed_new_writer$;
`;
    core = core.replace(
      alteration,
      `do $managed_writer_attributes$ begin
 if not exists(select 1 from pg_roles where rolname='${writer}' and ${restrictiveFlags}) then
  raise exception 'Unsafe Garage writer role attributes';
 end if;
end $managed_writer_attributes$;
grant ${writer} to "${operator}" with inherit true, set true;`,
    );
    adaptations.push(
      "assert restrictive role flags instead of protected ALTER ROLE",
    );
    adaptations.push(
      "transaction-local SET membership for the trusted creator",
    );
    adaptations.push(
      "temporary owner privileges through EXECUTE grant cleanup",
    );
  }
  let suffix = "";
  if (version >= 31n) {
    prefix += writerInvariant(operator);
    prefix += `grant ${writer} to "${operator}" with inherit true, set true;\n`;
    prefix += `revoke all on function public.create_garage_session_with_baseline(text,text,text,text,text,jsonb,text) from public, anon;
grant execute on function public.create_garage_session_with_baseline(text,text,text,text,text,jsonb,text) to authenticated;
`;
    adaptations.push(
      "reconcile prior baseline EXECUTE grants while owner privileges are active",
    );
    if (ownershipFiles.has(fileName)) {
      prefix += `grant create on schema public to ${writer};\n`;
      suffix += `\nrevoke create on schema public from ${writer};\n`;
      adaptations.push(
        "transaction-scoped schema CREATE for ownership transfer",
      );
    }
    adaptations.push(
      "transaction-scoped operator inheritance for owned routines",
    );
  }
  if (version >= 30n) {
    suffix += `\ngrant ${writer} to "${operator}" with inherit false, set true;\n`;
    suffix += writerInvariant(operator);
    suffix += garageExecutionInvariant();
  }
  const sql = prefix + core + suffix;
  return {
    file: fileName,
    operator,
    source_sha256: hash(sourceSql),
    execution_sha256: hash(sql),
    adaptations,
    sql,
  };
}

function main() {
  const { values, positionals } = parseArgs({
    options: { operator: { type: "string" }, sql: { type: "boolean" } },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length !== 1)
    throw new Error("Expected one source migration");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const directory = path.join(root, "supabase", "migrations");
  const input = positionals[0];
  const file =
    input === path.basename(input)
      ? path.join(directory, input)
      : path.resolve(root, input);
  if (
    path.dirname(file) !== directory ||
    !/^(?:[0-9]{4}|[0-9]{14})_[a-z0-9_]+\.sql$/.test(path.basename(file)) ||
    lstatSync(file).isSymbolicLink() ||
    !lstatSync(file).isFile() ||
    realpathSync(file) !== file
  ) {
    throw new Error(
      "Expected a regular source migration under supabase/migrations",
    );
  }
  const prepared = prepareManagedBootstrap({
    fileName: path.basename(file),
    sourceSql: readFileSync(file, "utf8"),
    operator: values.operator,
  });
  process.stdout.write(
    values.sql ? prepared.sql : JSON.stringify(prepared, null, 2) + "\n",
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof TypeError
        ? "Invalid preparation arguments"
        : error.message,
    );
    process.exitCode = 1;
  }
}
