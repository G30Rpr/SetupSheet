import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function runInventory(historyExists: boolean, mode?: string) {
  const directory = mkdtempSync(join(tmpdir(), "migration-plan-"));
  temporaryDirectories.push(directory);
  const log = join(directory, "queries.log");
  // Stand in for psql at the process boundary and capture every statement.
  writeFileSync(
    join(directory, "psql"),
    `#!/usr/bin/env bash
printf '%s\\n' "$@" >> "$QUERY_LOG"
if [[ "$*" == *to_regclass* ]]; then
  echo "$HISTORY_EXISTS"
else
  echo 0044
fi
`,
    { mode: 0o700 },
  );
  const result = spawnSync(
    "bash",
    ["scripts/deploy-migrations.sh", ...(mode ? [mode] : [])],
    {
      encoding: "utf8",
      timeout: 5000,
      env: {
        NODE_ENV: "test",
        PATH: `${directory}:${process.env.PATH}`,
        SUPABASE_DB_URL: "postgresql://unused.invalid/test",
        QUERY_LOG: log,
        HISTORY_EXISTS: historyExists ? "t" : "f",
      },
    },
  );
  return { ...result, queries: readFileSync(log, "utf8") };
}

describe("production migration inventory", () => {
  it("defaults to read-only planning and excludes applied versions", () => {
    const result = runInventory(true);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Read-only inventory");
    expect(result.stdout).not.toContain("0044_lock_profile_sync_rpc.sql");
    expect(result.stdout).toContain("0045_public_reporting_invoker_views.sql");
    expect(result.queries).toContain("begin read only;");
    expect(result.queries).not.toMatch(
      /create|insert|update|delete|--single-transaction|\n-f\n/i,
    );
  });

  it("lists a target without migration history without creating anything", () => {
    const result = runInventory(false, "--dry-run");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("History table is absent");
    expect(result.stdout).toContain("0001_init_setups_schema.sql");
    expect(result.queries).not.toMatch(/create|insert|--single-transaction/i);
  });

  it("refuses apply when history is absent", () => {
    const result = runInventory(false, "--apply");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("refusing to replay");
    expect(result.queries).not.toMatch(/create|insert|--single-transaction/i);
  });

  it("checks the complete pending batch before writing", () => {
    // The fake target has only 0044 applied, leaving legacy transaction-wrapped
    // files pending. Those require reconciliation rather than partial replay.
    const result = runInventory(true, "--apply");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("BEGIN/COMMIT");
    expect(result.queries).not.toContain("--single-transaction");
  });
});
