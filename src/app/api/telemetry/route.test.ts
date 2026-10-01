import { afterEach, describe, expect, it, vi } from "vitest";

const { loggerInfo } = vi.hoisted(() => ({ loggerInfo: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: loggerInfo, warn: vi.fn(), error: vi.fn() },
}));

const { POST } = await import("@/app/api/telemetry/route");

afterEach(() => vi.clearAllMocks());

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://setupsheet.app/api/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/telemetry", () => {
  it("logs only validated metrics and normalized paths", async () => {
    const response = await POST(request({
      events: [
        { kind: "metric", name: "LCP", value: 1800, rating: "good", path: "/setups/123e4567-e89b-42d3-a456-426614174000" },
        { kind: "pageview", name: "pageview", path: "/setups/:id" },
        { kind: "pageview", name: "pageview", path: "/setups?q=private" },
      ],
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(loggerInfo).toHaveBeenCalledOnce();
    const logged = JSON.stringify(loggerInfo.mock.calls[0]);
    expect(logged).toContain("/setups/:id");
    expect(logged).not.toContain("123e4567");
    expect(logged).not.toContain("private");
  });

  it("drops unrecognized routes and never persists raw error details", async () => {
    const response = await POST(request({ events: [
      { kind: "pageview", name: "pageview", path: "/profile/some-private-name" },
      { kind: "error", name: "window.error", path: "/", detail: "secret-token" },
    ] }));

    expect(response.status).toBe(204);
    expect(loggerInfo).toHaveBeenCalledOnce();
    const logged = JSON.stringify(loggerInfo.mock.calls[0]);
    expect(logged).toContain("window.error");
    expect(logged).not.toContain("secret-token");
    expect(logged).not.toContain("some-private-name");
  });

  it("rejects cross-origin reports", async () => {
    const response = await POST(request(
      { events: [{ kind: "pageview", name: "pageview", path: "/" }] },
      { origin: "https://attacker.example" }
    ));

    expect(response.status).toBe(403);
    expect(loggerInfo).not.toHaveBeenCalled();
  });

  it("rejects oversized request bodies", async () => {
    const response = await POST(new Request("https://setupsheet.app/api/telemetry", {
      method: "POST",
      headers: { "content-length": "9000" },
      body: "x".repeat(9000),
    }));

    expect(response.status).toBe(413);
    expect(loggerInfo).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(new Request("https://setupsheet.app/api/telemetry", {
      method: "POST",
      body: "not-json",
    }));

    expect(response.status).toBe(400);
  });
});
