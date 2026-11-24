import { describe, expect, it, vi } from "vitest";
import { cleanupStoragePaths } from "./storage-cleanup-protocol.mjs";

const path = "72000000-0000-4000-8000-000000000001/legacy.json";
const claim = "72000000-0000-4000-8000-000000000002";
function setup() {
  const rpc = vi.fn(async (name) => ({
    data: name === "claim_storage_cleanup" ? claim : true,
    error: null,
  }));
  const remove = vi.fn(async () => ({ data: [], error: null }));
  return {
    rpc,
    remove,
    client: { rpc, storage: { from: () => ({ remove }) } },
  };
}
const options = { grace: "24 hours", targetUser: null };

describe("Claim-based Storage deletion", () => {
  it("claims before removal and releases quota only after database confirmation", async () => {
    const { rpc, remove, client } = setup();
    expect(await cleanupStoragePaths(client, [path], options)).toEqual({
      deleted: 1,
      errors: 0,
      skipped: 0,
    });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "claim_storage_cleanup",
      "finish_storage_cleanup",
    ]);
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
      remove.mock.invocationCallOrder[0],
    );
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.mock.invocationCallOrder[1],
    );
    expect(rpc).toHaveBeenLastCalledWith("finish_storage_cleanup", {
      p_path: path,
      p_claim: claim,
    });
  });
  it.each([
    { data: null, error: null },
    { data: null, error: { message: "db unavailable" } },
    { data: "unsafe", error: null },
  ])(
    "never deletes when an atomic claim was not obtained: %j",
    async (response) => {
      const { rpc, remove, client } = setup();
      rpc.mockResolvedValue(response);
      await cleanupStoragePaths(client, [path], options);
      expect(remove).not.toHaveBeenCalled();
      expect(rpc).toHaveBeenCalledOnce();
    },
  );
  it("leaves a failed API deletion claimed, without cancelling or releasing it", async () => {
    const { rpc, remove, client } = setup();
    remove.mockResolvedValue({ data: null, error: { message: "timeout" } });
    expect(await cleanupStoragePaths(client, [path], options)).toMatchObject({
      deleted: 0,
      errors: 1,
    });
    expect(rpc).toHaveBeenCalledOnce();
  });
  it("does not trust a successful API response when metadata still exists", async () => {
    const { rpc, client } = setup();
    rpc.mockImplementation(async (name) => ({
      data: name === "claim_storage_cleanup" ? claim : false,
      error: null,
    }));
    expect(await cleanupStoragePaths(client, [path], options)).toMatchObject({
      deleted: 0,
      errors: 1,
    });
  });
  it("retries a prior successful removal with an empty API response", async () => {
    const { client } = setup();
    expect(await cleanupStoragePaths(client, [path], options)).toMatchObject({
      deleted: 1,
      errors: 0,
    });
  });
});
