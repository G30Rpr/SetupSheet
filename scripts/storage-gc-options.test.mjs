import { describe, expect, it } from "vitest";
import { parseStorageSweepArgs } from "./storage-gc-options.mjs";

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
