import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  target: vi.fn(),
  verify: vi.fn(),
  session: vi.fn(),
}));
vi.mock("@/lib/actions/setups", () => ({
  createUploadTarget: mocks.target,
  verifyUploadedFile: mocks.verify,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession: mocks.session } }),
}));
import { uploadFileDirectly } from "./upload-client";
const owner = "75000000-0000-4000-8000-000000000001";
const ticket = "75000000-0000-4000-8000-000000000002";
const path = `${owner}/test.json`;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://backend.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-public-key");
  mocks.target.mockResolvedValue({
    path,
    fileName: "test.json",
    token: ticket,
    error: null,
  });
  mocks.verify.mockResolvedValue({ path, fileName: "test.json", error: null });
  mocks.session.mockResolvedValue({
    data: { session: { access_token: "synthetic-user-jwt" } },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("browser application-ticket upload", () => {
  it("sends binary bytes and the user JWT to the fixed Edge endpoint, then verifies the result", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response('{"ok":true}'),
    );
    vi.stubGlobal("fetch", fetch);
    const file = new File(["{}"], "test.json");
    const progress = vi.fn();
    expect(
      (await uploadFileDirectly("setup", file, owner, progress)).path,
    ).toBe(path);
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      "https://backend.example/functions/v1/storage-upload",
    );
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: file,
      headers: {
        Authorization: "Bearer synthetic-user-jwt",
        apikey: "synthetic-public-key",
        "x-upload-ticket": ticket,
      },
    });
    expect(mocks.verify).toHaveBeenCalledWith("setup", path, "test.json");
    expect(progress.mock.calls).toEqual([[0], [100]]);
  });
  it("does not attach a file after the gateway fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 502 })),
    );
    const result = await uploadFileDirectly(
      "setup",
      new File(["{}"], "test.json"),
      owner,
    );
    expect(result.path).toBeNull();
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("does not send bytes without a browser session", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    mocks.session.mockResolvedValue({ data: { session: null } });
    expect(
      (await uploadFileDirectly("setup", new File(["{}"], "test.json"), owner))
        .path,
    ).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
