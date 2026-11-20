import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readBoundedRequestBody } from "@/lib/bounded-request-body";

function streamingRequest(
  body: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
) {
  return new Request("https://setupsheet.app/api/telemetry", {
    method: "POST",
    body,
    headers,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
});
afterEach(() => vi.useRealTimers());

describe("bounded request bodies", () => {
  it("accepts the exact byte limit and UTF-8 split across chunks", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0xe2]));
        controller.enqueue(new Uint8Array([0x82, 0xac]));
        controller.close();
      },
    });

    expect(await readBoundedRequestBody(streamingRequest(body), 3)).toEqual({
      ok: true,
      text: "€",
    });
    expect(body.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("enforces actual bytes with a missing or dishonest content length", async () => {
    const headerVariants: Record<string, string>[] = [
      {},
      { "content-length": "1" },
    ];
    for (const headers of headerVariants) {
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(2));
          controller.enqueue(new Uint8Array(2));
        },
        cancel,
      });
      expect(
        await readBoundedRequestBody(streamingRequest(body, headers), 3),
      ).toEqual({ ok: false, reason: "too-large" });
      expect(cancel).toHaveBeenCalledOnce();
      expect(body.locked).toBe(false);
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects oversized declarations without waiting for cancellation", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const body = new ReadableStream<Uint8Array>({ cancel });
    expect(
      await readBoundedRequestBody(
        streamingRequest(body, { "content-length": "4" }),
        3,
      ),
    ).toEqual({ ok: false, reason: "too-large" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out a stalled read even when cancellation never finishes", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const body = new ReadableStream<Uint8Array>({ cancel });
    const pending = readBoundedRequestBody(streamingRequest(body), 10);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(await pending).toEqual({ ok: false, reason: "timeout" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not restart the total deadline when a peer trickles more data", async () => {
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
    });
    const pending = readBoundedRequestBody(streamingRequest(body), 10);
    await vi.advanceTimersByTimeAsync(4_000);
    controller!.enqueue(new Uint8Array([1]));
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await pending).toEqual({ ok: false, reason: "timeout" });
    expect(body.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("handles a stream failure without leaking a lock or timer", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("peer disconnected"));
      },
    });
    expect(await readBoundedRequestBody(streamingRequest(body), 10)).toEqual({
      ok: false,
      reason: "unreadable",
    });
    expect(body.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("observes cancellation errors without failing the completed read", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4));
      },
      cancel: () => Promise.reject(new Error("cleanup failed")),
    });
    expect(await readBoundedRequestBody(streamingRequest(body), 3)).toEqual({
      ok: false,
      reason: "too-large",
    });
    expect(body.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
