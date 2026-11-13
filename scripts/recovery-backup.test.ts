import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";

it("encrypted export rejects unsafe destinations and removes partial artifacts", () => {
  const result = spawnSync("python3", ["scripts/test_recovery_backup.py"], {
    encoding: "utf8", timeout: 15_000,
  });
  expect(result.status, result.stderr).toBe(0);
});
