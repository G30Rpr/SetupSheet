import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => {
  const path = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/setup.sto";
  const remove = vi.fn(async (batch) => ({
    data: batch.map((name) => ({ name })),
    error: null,
  }));
  const rpc = vi.fn(async (name) => ({
    data:
      name === "storage_cleanup_candidates"
        ? [{ object_name: path }]
        : name === "claim_storage_cleanup"
          ? "71000000-0000-4000-8000-000000000001"
          : true,
    error: null,
  }));
  return { path, remove, rpc };
});
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: sdk.rpc,
    storage: { from: () => ({ remove: sdk.remove }) },
  }),
}));

let originalArguments;
let log;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  originalArguments = process.argv;
  vi.stubEnv("SUPABASE_URL", "https://staging.example.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-placeholder");
  log = vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  process.argv = originalArguments;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Storage sweep deletion boundary", () => {
  it.each([
    { args: [] },
    { args: ["--dry-run"] },
    { args: ["--user", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"] },
  ])("never invokes the Storage delete API for $args", async ({ args }) => {
    process.argv = ["node", "scripts/sweep-orphaned-files.mjs", ...args];
    await import("./sweep-orphaned-files.mjs");
    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("Dry-run complete"),
      ),
    );
    expect(sdk.rpc).toHaveBeenCalledOnce();
    expect(sdk.remove).not.toHaveBeenCalled();
  });

  it("invokes the mocked Storage delete API only with explicit apply", async () => {
    process.argv = ["node", "scripts/sweep-orphaned-files.mjs", "--apply"];
    await import("./sweep-orphaned-files.mjs");
    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("Finished: 1 deleted, 0 errors"),
      ),
    );
    expect(sdk.remove).toHaveBeenCalledExactlyOnceWith([sdk.path]);
  });
});
