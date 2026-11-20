import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  existsSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const workflow = yaml.load(
  readFileSync(".github/workflows/storage-gc.yml", "utf8"),
);
const step = workflow.jobs.sweep.steps.find(
  (value) => value.name === "Sweep orphaned Storage safely",
);
const revision = "1".repeat(40);

function invoke(overrides) {
  const directory = mkdtempSync(join(tmpdir(), "setupsheet-gc-workflow-"));
  const marker = join(directory, "npm-called");
  writeFileSync(
    join(directory, "npm"),
    '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$TEST_NPM_MARKER"\n',
    { mode: 0o700 },
  );
  writeFileSync(
    join(directory, "gh"),
    '#!/usr/bin/env bash\nprintf "%s\\n" "$TEST_HEAD_SHA"\n',
    { mode: 0o700 },
  );
  try {
    const result = spawnSync("bash", ["-c", step.run], {
      encoding: "utf8",
      timeout: 3_000,
      env: {
        NODE_ENV: "test",
        PATH: `${directory}:${process.env.PATH ?? "/usr/bin:/bin"}`,
        TEST_NPM_MARKER: marker,
        TEST_HEAD_SHA: revision,
        SUPABASE_URL: "https://staging.example.invalid",
        SUPABASE_SERVICE_ROLE_KEY: "test-only-placeholder",
        GC_APPLY: "false",
        GC_GRACE: "24 hours",
        DEFAULT_BRANCH: "SetUpSheet",
        GITHUB_REF: "refs/heads/SetUpSheet",
        GITHUB_SHA: revision,
        GITHUB_REPOSITORY: "G30Rpr/SetupSheet",
        ...overrides,
      },
    });
    return {
      ...result,
      args: existsSync(marker)
        ? readFileSync(marker, "utf8").trim().split("\n")
        : [],
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("Storage workflow command execution", () => {
  it("selects explicit dry-run for the scheduled/default mode", () => {
    const result = invoke({});
    expect(result.status, result.stderr).toBe(0);
    expect(result.args).toEqual([
      "run",
      "storage:sweep",
      "--",
      "--grace",
      "24 hours",
      "--dry-run",
    ]);
  });

  it("selects apply only for an explicit current-default-branch request", () => {
    const result = invoke({ GC_APPLY: "true" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.args).toContain("--apply");
    expect(result.args).not.toContain("--dry-run");
  });

  it.each([
    { GITHUB_REF: "refs/heads/unreviewed" },
    { TEST_HEAD_SHA: "2".repeat(40) },
  ])(
    "refuses a wrong branch or stale revision before invoking npm: %j",
    (override) => {
      const result = invoke({ GC_APPLY: "true", ...override });
      expect(result.status).toBe(1);
      expect(result.args).toEqual([]);
    },
  );
});
