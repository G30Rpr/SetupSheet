import { describe, expect, it, vi } from "vitest";
import {
  createUploadHandler,
  type UploadAdmin,
} from "../../supabase/functions/storage-upload/handler.ts";

const owner = "74000000-0000-4000-8000-000000000001";
const ticket = "74000000-0000-4000-8000-000000000002";
function setup(kind = "setup", path = `${owner}/file.json`, timeout = 1000) {
  const upload = vi.fn<ReturnType<UploadAdmin["storage"]["from"]>["upload"]>(
    async () => ({ data: {}, error: null }),
  );
  const rpc = vi.fn<UploadAdmin["rpc"]>(async (name: string) => ({
    data: name === "begin_storage_upload" ? { path, kind } : true,
    error: null,
  }));
  const getUser = vi.fn<UploadAdmin["auth"]["getUser"]>(async () => ({
    data: { user: { id: owner } },
    error: null,
  }));
  const admin = {
    auth: { getUser },
    rpc,
    storage: { from: () => ({ upload }) },
  } as unknown as UploadAdmin;
  return {
    upload,
    rpc,
    getUser,
    handle: createUploadHandler({
      admin,
      origins: ["https://app.example"],
      bodyTimeoutMs: timeout,
    }),
  };
}
function request(body: BodyInit = "{}", extra: Record<string, string> = {}) {
  return new Request("https://backend.example/functions/v1/storage-upload", {
    method: "POST",
    body,
    headers: {
      Origin: "https://app.example",
      Authorization: "Bearer synthetic-user-token",
      "x-upload-ticket": ticket,
      ...extra,
    },
    duplex: "half",
  } as RequestInit);
}
describe("trusted upload Edge handler", () => {
  it("verifies the JWT, consumes a ticket and confirms metadata before success", async () => {
    const { handle, rpc, getUser, upload } = setup();
    const response = await handle(request());
    expect(response.status).toBe(200);
    expect(getUser).toHaveBeenCalledWith("synthetic-user-token");
    expect(rpc).toHaveBeenNthCalledWith(1, "begin_storage_upload", {
      p_reservation: ticket,
      p_owner: owner,
    });
    expect(upload).toHaveBeenCalledWith(
      `${owner}/file.json`,
      expect.any(Uint8Array),
      { upsert: false, contentType: "application/octet-stream" },
    );
    expect(rpc).toHaveBeenNthCalledWith(2, "complete_storage_upload", {
      p_reservation: ticket,
    });
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://app.example",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("bounds isolate concurrency before consuming a ticket or reading bytes", async () => {
    const getUser = vi.fn();
    const inFlight = { active: 2 };
    const admin = { auth: { getUser } } as unknown as UploadAdmin;
    const handle = createUploadHandler({
      admin,
      origins: ["https://app.example"],
      inFlight,
    });
    const response = await handle(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("1");
    expect(getUser).not.toHaveBeenCalled();
    expect(inFlight.active).toBe(2);
  });
  it("denies unapproved origins before making privileged calls", async () => {
    const { handle, getUser, upload } = setup();
    expect(
      (await handle(request("{}", { Origin: "https://attacker.example" })))
        .status,
    ).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
  it("denies a missing or invalid session", async () => {
    const { handle, getUser, rpc } = setup();
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "expired" },
    });
    expect((await handle(request())).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("denies foreign, expired or replayed tickets before reading/uploading bytes", async () => {
    const { handle, rpc, upload } = setup();
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await handle(request())).status).toBe(409);
    expect(upload).not.toHaveBeenCalled();
  });
  it("checks actual bytes even when Content-Length is absent or false", async () => {
    const { handle, upload } = setup();
    expect(
      (
        await handle(
          request(new Uint8Array(5 * 1024 * 1024 + 1), {
            "Content-Length": "2",
          }),
        )
      ).status,
    ).toBe(413);
    expect(upload).not.toHaveBeenCalled();
  });
  it("bounds a stalled stream without releasing an uncertain reservation", async () => {
    const { handle, rpc, upload } = setup("setup", `${owner}/file.json`, 25);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
    });
    expect((await handle(request(body))).status).toBe(413);
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledOnce();
  });
  it("retains supported 10 MiB telemetry uploads outside Vercel's request limit", async () => {
    const { handle, upload } = setup("telemetry", `${owner}/file.ibt`);
    expect(
      (await handle(request(new Uint8Array(10 * 1024 * 1024)))).status,
    ).toBe(200);
    expect(upload).toHaveBeenCalledOnce();
  });
  it("checks file signatures on the trusted server", async () => {
    const { handle, upload } = setup();
    expect((await handle(request("not json"))).status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });
  it("never cancels a claim after an uncertain provider error", async () => {
    const { handle, rpc, upload } = setup();
    upload.mockResolvedValue({
      data: null,
      error: { message: "timeout" },
    });
    expect((await handle(request())).status).toBe(502);
    expect(rpc).toHaveBeenCalledOnce();
  });
  it("does not claim success until the completion RPC succeeds", async () => {
    const { handle, rpc } = setup();
    rpc.mockImplementation(async (name) => ({
      data:
        name === "begin_storage_upload"
          ? { path: `${owner}/file.json`, kind: "setup" }
          : false,
      error: null,
    }));
    expect((await handle(request())).status).toBe(502);
  });
});
