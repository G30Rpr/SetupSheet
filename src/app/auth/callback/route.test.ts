import { beforeEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

import { GET, sanitizeRedirectUrl } from "./route";

describe("sanitizeRedirectUrl", () => {
  it("defaults to root '/' when null or empty", () => {
    expect(sanitizeRedirectUrl(null)).toBe("/");
    expect(sanitizeRedirectUrl("")).toBe("/");
  });

  it("allows valid relative paths", () => {
    expect(sanitizeRedirectUrl("/setups")).toBe("/setups");
    expect(sanitizeRedirectUrl("/requests?game=iRacing")).toBe(
      "/requests?game=iRacing",
    );
    expect(sanitizeRedirectUrl("/profile/123")).toBe("/profile/123");
  });

  it("blocks open redirect attempts using protocol-relative syntax", () => {
    expect(sanitizeRedirectUrl("//attacker.com")).toBe("/");
    expect(sanitizeRedirectUrl("//evil.com/phishing")).toBe("/");
  });

  it("blocks open redirect attempts using backslashes", () => {
    expect(sanitizeRedirectUrl("/\\attacker.com")).toBe("/");
  });

  it("blocks absolute URLs", () => {
    expect(sanitizeRedirectUrl("https://attacker.com")).toBe("/");
    expect(sanitizeRedirectUrl("http://attacker.com")).toBe("/");
  });
});

describe("OAuth callback verifier selection", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("passes the callback flow ID to the SDK and keeps redirects on origin", async () => {
    const response = await GET(
      new Request(
        "https://setupsheet.example/auth/callback?code=test-code&sb_flow_id=flow_one123&next=/setups",
        { headers: { "x-forwarded-host": "attacker.example" } },
      ),
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith("test-code", {
      flowId: "flow_one123",
    });
    expect(response.headers.get("location")).toBe(
      "https://setupsheet.example/setups",
    );
  });

  it("retains the legacy callback when no flow ID was supplied", async () => {
    await GET(
      new Request("https://setupsheet.example/auth/callback?code=test-code"),
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith("test-code");
  });

  it.each(["", "invalid!"])(
    "does not silently discard an explicit flow ID: %s",
    async (flowId) => {
      exchangeCodeForSession.mockResolvedValue({
        error: { message: "missing verifier" },
      });
      const response = await GET(
        new Request(
          `https://setupsheet.example/auth/callback?code=test-code&sb_flow_id=${encodeURIComponent(flowId)}`,
        ),
      );
      expect(exchangeCodeForSession).toHaveBeenCalledWith("test-code", {
        flowId,
      });
      expect(response.headers.get("location")).toBe(
        "https://setupsheet.example/auth/auth-code-error",
      );
    },
  );
});
