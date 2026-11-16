import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/setups/[id]/bundle/route";
import type { Setup } from "@/lib/types";

const { getSetupByIdMock } = vi.hoisted(() => ({ getSetupByIdMock: vi.fn() }));

vi.mock("@/lib/supabase/setups", () => ({ getSetupById: getSetupByIdMock }));

const SETUP_ID = "11111111-1111-4111-8111-111111111111";

function makeSetup(overrides: Partial<Setup> = {}): Setup {
  return {
    id: SETUP_ID,
    game: "iRacing",
    car: "BMW M4 GT3",
    track: "Spa-Francorchamps",
    condition: "Dry",
    lapTime: "2:19.104",
    description: "Stable quali setup.",
    tags: [],
    rigProfile: "Direct Drive + Load Cell",
    author: "Max",
    authorId: "22222222-2222-4222-8222-222222222222",
    authorAvatarUrl: null,
    uploadedAt: "2026-07-01T00:00:00.000Z",
    upvotes: 3,
    hasUpvoted: false,
    hasFavorited: false,
    pace: 4.2,
    predictability: 4.5,
    ratingCount: 6,
    myRating: null,
    isOwner: false,
    downloads: 4,
    fileName: "spa-quali.sto",
    fileUrl: "https://storage.example/setup-files/user/spa-quali.sto",
    ...overrides,
  };
}

function call(id = SETUP_ID) {
  return GET(new Request(`https://setupsheet.app/api/setups/${id}/bundle`), {
    params: Promise.resolve({ id }),
  });
}

/** Minimal reader so assertions run against the archive, not the implementation. */
function entryNames(archive: Uint8Array): string[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  let eocd = -1;
  for (let i = archive.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("no end-of-central-directory record");
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    names.push(new TextDecoder().decode(archive.subarray(offset + 46, offset + 46 + nameLength)));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

async function readZip(response: Response) {
  const archive = new Uint8Array(await response.arrayBuffer());
  return { archive, names: entryNames(archive) };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("GET /api/setups/[id]/bundle", () => {
  it("rejects a non-uuid id without touching the database", async () => {
    const response = await call("not-a-uuid");

    expect(response.status).toBe(400);
    expect(getSetupByIdMock).not.toHaveBeenCalled();
  });

  it("404s an unknown setup", async () => {
    getSetupByIdMock.mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(404);
  });

  it("404s a setup with neither a file nor values to bundle", async () => {
    getSetupByIdMock.mockResolvedValue(makeSetup({ fileUrl: null, fileName: null }));

    const response = await call();

    expect(response.status).toBe(404);
  });

  it("returns a zip containing the setup file, a values export and the README", async () => {
    getSetupByIdMock.mockResolvedValue(
      makeSetup({ setupValues: { frontWing: "5", rearWing: "7" } })
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })
      )
    );

    const response = await call();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("content-disposition")).toMatch(/\.zip"/);

    const { archive, names } = await readZip(response);
    expect(names).toContain("README.txt");
    expect(names).toContain("spa-quali.sto");
    // The values are inside the README rather than a second file when a real
    // setup file is present -- one file to read, not two.
    expect(names).toHaveLength(2);
    expect(archive.length).toBeGreaterThan(4);
  });

  it("returns an uncached error instead of a misleading ZIP when the file fetch fails", async () => {
    getSetupByIdMock.mockResolvedValue(makeSetup());
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const response = await call();

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: "The setup file is unavailable. Please try again." });
  });

  it.each([403, 404, 500])("rejects an upstream HTTP %s even when values are available", async (status) => {
    getSetupByIdMock.mockResolvedValue(makeSetup({ setupValues: { frontWing: "5" } }));
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status })));

    const response = await call();

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects an advertised oversized file before reading it", async () => {
    getSetupByIdMock.mockResolvedValue(makeSetup());
    const cancel = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      new ReadableStream({ cancel }),
      { headers: { "Content-Length": String(10 * 1024 * 1024 + 1) } }
    )));

    expect((await call()).status).toBe(502);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([undefined, "1"])("bounds actual bytes when Content-Length is %s", async (length) => {
    getSetupByIdMock.mockResolvedValue(makeSetup());
    const cancel = vi.fn();
    let chunks = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunks += 1;
        controller.enqueue(new Uint8Array(6 * 1024 * 1024));
      },
      cancel,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, {
      headers: length ? { "Content-Length": length } : {},
    })));

    expect((await call()).status).toBe(502);
    expect(cancel).toHaveBeenCalledOnce();
    expect(chunks).toBeLessThanOrEqual(3);
  });

  it("accepts an existing attachment exactly at the 10 MiB bucket limit", async () => {
    getSetupByIdMock.mockResolvedValue(makeSetup());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(new Uint8Array(10 * 1024 * 1024))
    ));

    const response = await call();

    expect(response.status).toBe(200);
    expect((await readZip(response)).names).toEqual(["README.txt", "spa-quali.sto"]);
  });

  it("rejects an empty attached file", async () => {
    getSetupByIdMock.mockResolvedValue(makeSetup());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array())));
    expect((await call()).status).toBe(502);
  });

  it("rejects a stream error instead of delivering a truncated archive", async () => {
    getSetupByIdMock.mockResolvedValue(makeSetup());
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.error(new Error("disconnected")); },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    expect((await call()).status).toBe(502);
  });

  it("times out a fetch that never returns headers", async () => {
    vi.useFakeTimers();
    getSetupByIdMock.mockResolvedValue(makeSetup());
    vi.stubGlobal("fetch", vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    })));

    const pending = call();
    await vi.advanceTimersByTimeAsync(10_000);
    const response = await pending;

    expect(response.status).toBe(504);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out and cancels a stalled body after headers arrive", async () => {
    vi.useFakeTimers();
    getSetupByIdMock.mockResolvedValue(makeSetup());
    const cancel = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }))));

    const pending = call();
    await vi.advanceTimersByTimeAsync(10_000);
    const response = await pending;

    expect(response.status).toBe(504);
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bundles a generated values file for a setup with no uploaded file", async () => {
    getSetupByIdMock.mockResolvedValue(
      makeSetup({ fileUrl: null, fileName: null, setupValues: { frontWing: "5" } })
    );

    const response = await call();

    expect(response.status).toBe(200);
    const { names } = await readZip(response);
    expect(names).toContain("README.txt");
    expect(names.some((name) => name.endsWith(".txt") && name !== "README.txt")).toBe(true);
  });
});
