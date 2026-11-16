import { afterEach, describe, expect, it, vi } from "vitest";

const { select, limit } = vi.hoisted(() => ({
  select: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({
    from: (name: string) => {
      if (name !== "setups") throw new Error("unexpected table");
      return { select };
    },
  }),
}));

const { GET } = await import("@/app/api/health/route");

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/health", () => {
  it("returns a minimal uncached response when public Supabase reads succeed", async () => {
    select.mockReturnValue({ limit });
    limit.mockResolvedValue({ data: [], error: null });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(select).toHaveBeenCalledWith("id");
    expect(limit).toHaveBeenCalledWith(1);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("fails closed without exposing backend error details", async () => {
    select.mockReturnValue({ limit });
    limit.mockResolvedValue({
      data: null,
      error: { message: "sensitive-hostname and private query details" },
    });
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toContain("unavailable");
    expect(body).not.toContain("sensitive-hostname");
  });

  it("handles unexpected client failures", async () => {
    select.mockImplementation(() => { throw new Error("connection secret"); });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
});
