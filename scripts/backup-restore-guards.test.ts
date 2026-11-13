import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

const scripts = [
  "scripts/backup-supabase-encrypted.sh",
  "scripts/verify-supabase-backup.sh",
];

describe("operator-controlled backup and restore scripts", () => {
  it.each(scripts)("%s is valid Bash", (path) => {
    const result = spawnSync("bash", ["-n", path], {
      encoding: "utf8",
      timeout: 3000,
    });
    expect(result.status, result.stderr).toBe(0);
  });

  it.each(scripts)("%s fails closed without operator credentials", (path) => {
    const result = spawnSync("bash", [path], {
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      encoding: "utf8",
      timeout: 3000,
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toMatch(/Restore completed|Encrypted backup saved/);
  });
});
