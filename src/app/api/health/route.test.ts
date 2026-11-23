import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { limit, select, from } = vi.hoisted(() => {
  const limit = vi.fn();
  const select = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ select }));
  return { limit, select, from };
});
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ from }),
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe("public database readiness", () => {
  it("accepts an empty database and queries one explicit public column", async () => {
    limit.mockResolvedValue({ data: [], error: null });
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(from).toHaveBeenCalledWith("setups");
    expect(select).toHaveBeenCalledWith("id");
    expect(limit).toHaveBeenCalledWith(1);
  });
  it("coalesces concurrent calls without sharing consumable response bodies", async () => {
    let complete!: (value: { data: never[]; error: null }) => void;
    limit.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const { GET } = await import("./route");
    const first = GET();
    const second = GET();
    expect(limit).toHaveBeenCalledOnce();
    complete({ data: [], error: null });
    expect(await (await first).json()).toEqual({ status: "ok" });
    expect(await (await second).json()).toEqual({ status: "ok" });
  });
  it("does not leak backend error details and retries failures after a short cache", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(10_000);
    limit.mockResolvedValue({
      data: null,
      error: { message: "private connection details" },
    });
    const { GET } = await import("./route");
    const failed = await GET();
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ status: "unavailable" });
    clock.mockReturnValue(10_500);
    await GET();
    expect(limit).toHaveBeenCalledOnce();
    limit.mockResolvedValue({ data: [], error: null });
    clock.mockReturnValue(11_100);
    expect((await GET()).status).toBe(200);
    expect(limit).toHaveBeenCalledTimes(2);
  });
  it("turns thrown network failures into a non-cacheable unavailable response", async () => {
    limit.mockRejectedValue(new Error("connection failed"));
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
