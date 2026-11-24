import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { prepareManagedBootstrap } from "../prepare-managed-bootstrap.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const cli = path.join(root, "scripts/prepare-managed-bootstrap.mjs");
const migration = (name) => path.join(root, "supabase/migrations", name);

test("rejects unsafe or missing operator identifiers", () => {
  for (const operator of [
    undefined,
    "",
    "postgres; reset role",
    "a'b",
    "a".repeat(64),
  ]) {
    assert.throws(() =>
      prepareManagedBootstrap({
        fileName: "0001_init_setups_schema.sql",
        sourceSql: "select 1;",
        operator,
      }),
    );
  }
});

test("rejects paths and unversioned migration names", () => {
  for (const fileName of [
    "../0001_init.sql",
    "/tmp/0001_init.sql",
    "init.sql",
    "0001_init.sql;select 1",
  ]) {
    assert.throws(() =>
      prepareManagedBootstrap({
        fileName,
        sourceSql: "select 1;",
        operator: "fixture_operator",
      }),
    );
  }
});

test("refuses unreviewed or malformed transaction boundaries", () => {
  for (const [fileName, sourceSql] of [
    ["0048_new.sql", "begin;\nselect 1;\ncommit;"],
    ["0031_garage_start_from_setup.sql", "commit;\nselect 1;\nbegin;"],
    ["0031_garage_start_from_setup.sql", "begin;\nbegin;\nselect 1;\ncommit;"],
  ])
    assert.throws(() =>
      prepareManagedBootstrap({
        fileName,
        sourceSql,
        operator: "fixture_operator",
      }),
    );
});

test("requires review if the legacy Garage protected-role clause changes", () => {
  const sourceSql = readFileSync(
    migration("0030_garage_private_workflow.sql"),
    "utf8",
  ).replaceAll("nobypassrls", "bypassrls");
  assert.throws(() =>
    prepareManagedBootstrap({
      fileName: "0030_garage_private_workflow.sql",
      sourceSql,
      operator: "fixture_operator",
    }),
  );
});

test("CLI emits verifiable provenance without modifying the historical file", () => {
  const fileName = "0030_garage_private_workflow.sql";
  const before = readFileSync(migration(fileName));
  const result = spawnSync(
    process.execPath,
    [cli, "--operator", "fixture_operator", fileName],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const prepared = JSON.parse(result.stdout);
  assert.equal(
    prepared.source_sha256,
    createHash("sha256").update(before).digest("hex"),
  );
  assert.equal(
    prepared.execution_sha256,
    createHash("sha256").update(prepared.sql).digest("hex"),
  );
  assert.deepEqual(readFileSync(migration(fileName)), before);
});

test("CLI rejects non-migration files without printing their contents", () => {
  const result = spawnSync(
    process.execPath,
    [cli, "--operator", "fixture_operator", "package.json"],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
});
