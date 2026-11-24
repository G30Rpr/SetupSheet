import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  existsSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Include new standalone concurrency/drift helpers automatically, so a scratch
// name cannot become their only guard when they are introduced by another PR.
const harnesses = new Set([
  "scripts/test-db.sh",
  "scripts/test-managed-bootstrap.sh",
]);
const scripts = readdirSync("scripts")
  .filter(
    (name) =>
      harnesses.has(`scripts/${name}`) ||
      /-(?:concurrency|drift)\.sh$/.test(name),
  )
  .map((name) => `scripts/${name}`);
const rejectedEnvironments: Record<string, string>[] = [
  { PGHOST: "db.production.example" },
  { PGHOST: "127.0.0.1,db.production.example" },
  { PGHOST: "/tmp/postgres-socket" },
  { PGHOSTADDR: "203.0.113.1" },
  { PGSERVICE: "production" },
  { PGSERVICEFILE: "/tmp/production-service.conf" },
  { PGPORT: "0" },
  { PGPORT: "65536" },
  { PGPORT: "not-a-port" },
];

function invoke(
  script: string,
  overrides: Record<string, string>,
  database = "setupsheet_migration_test_123",
) {
  const directory = mkdtempSync(join(tmpdir(), "setupsheet-db-guard-"));
  const marker = join(directory, "psql-called");
  writeFileSync(
    join(directory, "psql"),
    '#!/usr/bin/env bash\nprintf "%s\\n" "$@" >> "$TEST_PSQL_MARKER"\nif [[ "${TEST_PSQL_READY:-}" == "false" ]]; then printf "f\\n"; exit 0; fi\nexit 97\n',
    { mode: 0o700 },
  );
  try {
    const result = spawnSync(
      "bash",
      harnesses.has(script) ? [script] : [script, database],
      {
        encoding: "utf8",
        timeout: 3_000,
        env: {
          NODE_ENV: "test",
          PATH: `${directory}:${process.env.PATH ?? "/usr/bin:/bin"}`,
          TEST_PSQL_MARKER: marker,
          ...overrides,
        },
      },
    );
    return {
      ...result,
      calls: existsSync(marker) ? readFileSync(marker, "utf8") : "",
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe.each(scripts)("%s destructive-target safeguards", (script) => {
  it.each(rejectedEnvironments)(
    "rejects %j before invoking psql, including cleanup",
    (environment) => {
      const result = invoke(script, environment);
      expect(result.status, result.stderr).toBe(1);
      expect(result.stderr).toContain("Refusing");
      expect(result.calls).toBe("");
    },
  );

  it.each(["localhost", "127.0.0.1", "::1"])(
    "allows %s and disables psql startup files",
    (PGHOST) => {
      const result = invoke(script, { PGHOST });
      // The stand-in exits immediately; no real PostgreSQL server is contacted.
      expect(result.status, result.stderr).toBe(97);
      expect(result.calls).toMatch(/(?:^|\n)-[A-Za-z]*X/);
    },
  );
});

describe.each(scripts.filter((script) => !harnesses.has(script)))(
  "%s database-name validation",
  (script) => {
    it.each([
      "postgres",
      "host=production.example dbname=test",
      "postgresql://production.example/test",
      "setupsheet_migration_test_123;drop table profiles",
    ])("rejects an unsafe standalone test database name: %s", (database) => {
      const result = invoke(script, {}, database);
      expect(result.status, result.stderr).toBe(1);
      expect(result.calls).toBe("");
    });
  },
);

it("managed bootstrap rejects inherited PGOPTIONS before invoking psql", () => {
  const result = invoke("scripts/test-managed-bootstrap.sh", {
    PGOPTIONS: "-c role=postgres",
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Refusing PGOPTIONS");
  expect(result.calls).toBe("");
});

it("managed bootstrap refuses a non-isolated fixture before creating or cleaning up anything", () => {
  const result = invoke("scripts/test-managed-bootstrap.sh", {
    TEST_PSQL_READY: "false",
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Requires a dedicated PostgreSQL");
  expect(result.calls).not.toMatch(/\b(?:CREATE|DROP)\s+(?:ROLE|DATABASE)\b/i);
});
