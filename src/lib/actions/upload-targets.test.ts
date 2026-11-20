import { beforeEach, describe, expect, it, vi } from "vitest";
const USER_ID = "7ec21b4c-4a9b-4044-b2be-f6929af9be6a";
const TICKET = "71000000-0000-4000-8000-000000000001";
const storageInfo = vi.fn();
const consumeUploadTargetRateLimit = vi.fn();
const getCurrentUser = vi.fn();
const adminRpc = vi.fn();
const createStorageAdminClient = vi.fn();
vi.mock("@/lib/supabase/storage-admin", () => ({ createStorageAdminClient }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: consumeUploadTargetRateLimit,
    storage: { from: () => ({ info: storageInfo }) },
  }),
}));
vi.mock("@/lib/supabase/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}));
const { createUploadTarget, verifyUploadedFile, discardUploadedFiles } =
  await import("@/lib/actions/setups");

describe("createUploadTarget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: USER_ID });
    consumeUploadTargetRateLimit.mockResolvedValue({ data: true, error: null });
    adminRpc.mockResolvedValue({ data: TICKET, error: null });
    // No Storage signer is available: this action must never mint provider URLs.
    createStorageAdminClient.mockReturnValue({ rpc: adminRpc });
  });
  it("returns a generated owner path and opaque one-use application ticket", async () => {
    const result = await createUploadTarget("setup", "Monza Q.json", 1024);
    expect(result.error).toBeNull();
    expect(result.token).toBe(TICKET);
    expect(result.path?.startsWith(`${USER_ID}/`)).toBe(true);
    expect(result.fileName).toBe("Monza_Q.json");
    expect(adminRpc).toHaveBeenCalledExactlyOnceWith("reserve_storage_upload", {
      p_owner: USER_ID,
      p_path: result.path,
      p_kind: "setup",
    });
  });
  it.each([
    { kind: "setup", name: "payload.html", size: 1 },
    { kind: "setup", name: "large.json", size: 6 * 1024 * 1024 },
    { kind: "avatar", name: "image.png", size: 1 },
  ])(
    "rejects invalid input before reserving capacity: $name",
    async ({ kind, name, size }) => {
      const result = await createUploadTarget(kind as "setup", name, size);
      expect(result.error).not.toBeNull();
      expect(adminRpc).not.toHaveBeenCalled();
    },
  );
  it("does not reserve for an anonymous caller", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(
      (await createUploadTarget("setup", "test.json", 1)).token,
    ).toBeNull();
    expect(adminRpc).not.toHaveBeenCalled();
  });
  it.each([
    { data: false, error: null },
    { data: null, error: { message: "unavailable" } },
  ])(
    "checks shared issuance rate limits before the quota RPC: %j",
    async (response) => {
      consumeUploadTargetRateLimit.mockResolvedValue(response);
      expect(
        (await createUploadTarget("setup", "test.json", 1)).token,
      ).toBeNull();
      expect(adminRpc).not.toHaveBeenCalled();
    },
  );
  it("fails closed without a server credential", async () => {
    createStorageAdminClient.mockReturnValue(null);
    expect(
      (await createUploadTarget("setup", "test.json", 1)).token,
    ).toBeNull();
    expect(adminRpc).not.toHaveBeenCalled();
  });
  it("withholds paths and tickets when quota reservation fails", async () => {
    adminRpc.mockResolvedValue({ data: null, error: { message: "quota" } });
    const result = await createUploadTarget("setup", "test.json", 1);
    expect(result.path).toBeNull();
    expect(result.token).toBeNull();
  });
  it("does not immediately delete abandoned files that another save may reference", async () => {
    await discardUploadedFiles([`${USER_ID}/test.json`]);
    expect(adminRpc).not.toHaveBeenCalled();
    expect(storageInfo).not.toHaveBeenCalled();
  });
});

describe("verifyUploadedFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: USER_ID });
    storageInfo.mockResolvedValue({ data: { size: 2048 }, error: null });
  });

  it("accepts an object in the caller's own folder and returns the canonical pair", async () => {
    const path = `${USER_ID}/mno-123-Monza.json`;
    const result = await verifyUploadedFile("setup", path, "Monza.json");

    expect(result.error).toBeNull();
    expect(result.path).toBe(path);
    expect(result.fileName).toBe("Monza.json");
  });

  it("rejects a path belonging to another user before touching Storage", async () => {
    const foreign = "11111111-2222-3333-4444-555555555555/their-file.json";
    const result = await verifyUploadedFile(
      "setup",
      foreign,
      "their-file.json",
    );

    expect(result.error).toContain("doesn't belong");
    expect(storageInfo).not.toHaveBeenCalled();
  });

  it("rejects traversal and multi-segment paths", async () => {
    for (const bad of [
      `${USER_ID}/../other.json`,
      `${USER_ID}/a/b.json`,
      "not-a-path",
    ]) {
      const result = await verifyUploadedFile("setup", bad, "other.json");
      expect(result.error).not.toBeNull();
    }
    expect(storageInfo).not.toHaveBeenCalled();
  });

  it("rejects a missing object (upload never landed)", async () => {
    storageInfo.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    const result = await verifyUploadedFile(
      "setup",
      `${USER_ID}/x-Monza.json`,
      "Monza.json",
    );

    expect(result.error).toContain("didn't finish");
  });

  it("rejects an object Storage reports as empty", async () => {
    storageInfo.mockResolvedValue({ data: { size: 0 }, error: null });

    const result = await verifyUploadedFile(
      "setup",
      `${USER_ID}/x-Monza.json`,
      "Monza.json",
    );

    expect(result.error).toContain("empty");
  });

  it("rejects an object Storage reports as over the per-kind limit", async () => {
    storageInfo.mockResolvedValue({
      data: { size: 11 * 1024 * 1024 },
      error: null,
    });

    const result = await verifyUploadedFile(
      "setup",
      `${USER_ID}/x-Monza.json`,
      "Monza.json",
    );

    expect(result.error).toContain("5 MB");
  });

  it("rejects a filename whose extension is not allowed for that kind", async () => {
    const result = await verifyUploadedFile(
      "setup",
      `${USER_ID}/x-run.vbo`,
      "run.vbo",
    );

    expect(result.error).toContain("Unsupported");
  });

  it("refuses an anonymous caller", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await verifyUploadedFile(
      "setup",
      `${USER_ID}/x-Monza.json`,
      "Monza.json",
    );

    expect(result.error).toContain("logged in");
    expect(storageInfo).not.toHaveBeenCalled();
  });
});
