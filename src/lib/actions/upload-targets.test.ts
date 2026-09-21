import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Covers the security-relevant half of the direct-to-Storage upload flow:
 * who gets a signed URL, where it points, and what happens to the path
 * afterwards. The path is the whole boundary -- Supabase Storage policies key
 * off `<userId>/<object>` -- so every case below asserts either that no
 * signing happened, or that the signed path stayed inside the caller's folder.
 */

const USER_ID = "7ec21b4c-4a9b-4044-b2be-f6929af9be6a";

const createSignedUploadUrl = vi.fn();
const storageInfo = vi.fn();
const getCurrentUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    storage: {
      from: () => ({
        createSignedUploadUrl,
        info: storageInfo,
      }),
    },
  }),
}));

vi.mock("@/lib/supabase/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}));

const { createUploadTarget, verifyUploadedFile } = await import("@/lib/actions/setups");

describe("createUploadTarget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: USER_ID });
    createSignedUploadUrl.mockResolvedValue({ data: { token: "signed-token" }, error: null });
  });

  it("returns an owner-scoped path and token for a valid, authenticated upload", async () => {
    const result = await createUploadTarget("setup", "Monza Q.json", 1024);

    expect(result.error).toBeNull();
    expect(result.token).toBe("signed-token");
    expect(result.path?.startsWith(`${USER_ID}/`)).toBe(true);
    expect(result.fileName).toBe("Monza_Q.json");
    expect(createSignedUploadUrl).toHaveBeenCalledWith(result.path);
  });

  it("refuses an anonymous caller without signing anything", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await createUploadTarget("setup", "Monza.json", 1024);

    expect(result.error).toContain("logged in");
    expect(result.path).toBeNull();
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("refuses a disallowed extension without signing anything", async () => {
    const result = await createUploadTarget("setup", "payload.html", 1024);

    expect(result.error).toContain("Unsupported");
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("refuses a file over the limit without signing anything", async () => {
    const result = await createUploadTarget("setup", "big.json", 6 * 1024 * 1024);

    expect(result.error).toContain("5 MB");
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("surfaces a signing failure as a retryable error and leaks no path", async () => {
    createSignedUploadUrl.mockResolvedValue({ data: null, error: { message: "nope" } });

    const result = await createUploadTarget("setup", "Monza.json", 1024);

    expect(result.path).toBeNull();
    expect(result.token).toBeNull();
    expect(result.error).toContain("try again");
  });

  it("rejects an unknown upload kind", async () => {
    // @ts-expect-error deliberately invalid at the type level too
    const result = await createUploadTarget("avatar", "a.png", 10);

    expect(result.error).toContain("Unsupported upload type");
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
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
    const result = await verifyUploadedFile("setup", foreign, "their-file.json");

    expect(result.error).toContain("doesn't belong");
    expect(storageInfo).not.toHaveBeenCalled();
  });

  it("rejects traversal and multi-segment paths", async () => {
    for (const bad of [`${USER_ID}/../other.json`, `${USER_ID}/a/b.json`, "not-a-path"]) {
      const result = await verifyUploadedFile("setup", bad, "other.json");
      expect(result.error).not.toBeNull();
    }
    expect(storageInfo).not.toHaveBeenCalled();
  });

  it("rejects a missing object (upload never landed)", async () => {
    storageInfo.mockResolvedValue({ data: null, error: { message: "not found" } });

    const result = await verifyUploadedFile("setup", `${USER_ID}/x-Monza.json`, "Monza.json");

    expect(result.error).toContain("didn't finish");
  });

  it("rejects an object Storage reports as empty", async () => {
    storageInfo.mockResolvedValue({ data: { size: 0 }, error: null });

    const result = await verifyUploadedFile("setup", `${USER_ID}/x-Monza.json`, "Monza.json");

    expect(result.error).toContain("empty");
  });

  it("rejects an object Storage reports as over the per-kind limit", async () => {
    storageInfo.mockResolvedValue({ data: { size: 11 * 1024 * 1024 }, error: null });

    const result = await verifyUploadedFile("setup", `${USER_ID}/x-Monza.json`, "Monza.json");

    expect(result.error).toContain("5 MB");
  });

  it("rejects a filename whose extension is not allowed for that kind", async () => {
    const result = await verifyUploadedFile("setup", `${USER_ID}/x-run.vbo`, "run.vbo");

    expect(result.error).toContain("Unsupported");
  });

  it("refuses an anonymous caller", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await verifyUploadedFile("setup", `${USER_ID}/x-Monza.json`, "Monza.json");

    expect(result.error).toContain("logged in");
    expect(storageInfo).not.toHaveBeenCalled();
  });
});
