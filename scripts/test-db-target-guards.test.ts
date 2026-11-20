import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const scripts = [
  ["scripts/test-db.sh", []],
  ["scripts/test-fulfillment-concurrency.sh", ["setupsheet_migration_test_12345"]],
] as const;

describe("destructive PostgreSQL test harness target guards", () => {
  it.each(scripts)("%s parses as Bash", (script) => {
    const result = spawnSync("bash", ["-n", script], {
      timeout: 3000,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
  });

  it.each(scripts)("%s refuses remote PGHOST before any database access", (script, args) => {
    const result = spawnSync("bash", [script, ...args], {
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        PGHOST: "db.production.invalid",
        PGUSER: "postgres",
      },
      timeout: 3000,
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/non-loopback PGHOST/);
    expect(result.stdout).not.toMatch(/Created scratch database|Concurrent fulfillment passed/);
  });

  it.each(scripts)("%s refuses libpq host overrides", (script, args) => {
    const result = spawnSync("bash", [script, ...args], {
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        PGHOST: "localhost",
        PGHOSTADDR: "192.0.2.20",
        PGUSER: "postgres",
      },
      timeout: 3000,
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/hostaddr\/service overrides/);
  });
});
