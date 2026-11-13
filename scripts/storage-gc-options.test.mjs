import { describe, expect, it } from "vitest";
import { parseStorageSweepArgs, validateCleanupPaths } from "./storage-gc-options.mjs";

describe("Storage cleanup command safety", () => {
  it("defaults to the existing weekly 24h policy", () => {
    expect(parseStorageSweepArgs([])).toEqual({
      dryRun: false, grace: "24 hours", targetUser: null, batchSize: 50,
    });
  });

  it("supports safe dry run and bounded configuration", () => {
    expect(parseStorageSweepArgs(["--dry-run", "--grace", "7 days", "--batch-size", "100"])).toMatchObject({
      dryRun: true, grace: "7 days", batchSize: 100,
    });
  });

  it.each([
    ["--grace", "1 day'; echo hacked"],
    ["--grace", "0 days"],
    ["--grace", "1 hour"],
    ["--grace", "31 days"],
    ["--batch-size", "0"],
    ["--batch-size", "101"],
    ["--batch-size", "NaN"],
    ["--user", "other-users-id"],
    ["--not-a-real-option"],
    ["--grace"],
    ["--grace", "24 hours", "--grace", "24 hours"],
  ])("rejects invalid or dangerous arguments: %j", (...args) => {
    expect(() => parseStorageSweepArgs(args)).toThrow();
  });

  it("requires explicit user-deletion confirmation for destructive account cleanup", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(() => parseStorageSweepArgs(["--user", id])).toThrow(/--confirm-user-delete/);
    expect(parseStorageSweepArgs(["--user", id, "--dry-run"]).dryRun).toBe(true);
    expect(parseStorageSweepArgs(["--user", id, "--confirm-user-delete"]).targetUser).toBe(id);
    expect(() => parseStorageSweepArgs(["--confirm-user-delete"])).toThrow(/requires --user/);
  });
});

describe("Storage cleanup path validation", () => {
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const second = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("keeps valid owner paths and drops duplicates", () => {
    expect(validateCleanupPaths([`${id}/setup.sto`, `${id}/setup.sto`], id)).toEqual([`${id}/setup.sto`]);
  });

  it.each([
    "not-a-user/setup.sto",
    `${id}/../setup.sto`,
    `${id}/`,
    `${id}/..`,
    `${id}/folder/file.sto`,
    "unknown",
    `${second}/setup.sto`,
  ])("rejects unowned or unsafe object paths: %s", (path) => {
    expect(() => validateCleanupPaths([path], id)).toThrow();
  });

  it("rejects non-array backend responses", () => {
    expect(() => validateCleanupPaths(null)).toThrow();
  });
});
