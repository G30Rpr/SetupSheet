import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { POST } from "@/app/api/csp-report/route";

/**
 * The reporting endpoint is attacker-reachable by design (any page can POST a
 * violation report), so these tests pin the two properties that matter:
 * it never throws, and it never reflects or over-reads what it was sent.
 */

/** logger.warn emits one JSON line as the single console argument. */
function loggedPayload(call: unknown[]): string {
  return String(call[0] ?? "");
}

function postJson(body: unknown) {
  return POST(
    new Request("https://setupsheet.app/api/csp-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

describe("POST /api/csp-report", () => {
  // Re-created per test: a single describe-scoped spy is restored by the first
  // afterEach, after which later tests silently observe nothing.
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => warn.mockRestore());

  it("accepts a legacy csp-report payload with a 204 and logs the directive", async () => {
    const response = await postJson({
      "csp-report": {
        "blocked-uri": "https://evil.example/script.js",
        "violated-directive": "script-src",
        "document-uri": "https://setupsheet.app/setups",
      },
    });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(warn).toHaveBeenCalledOnce();
    expect(loggedPayload(warn.mock.calls[0])).toContain("CSP violation");
  });

  it("accepts the Reporting API array form", async () => {
    const response = await postJson([
      {
        type: "csp-violation",
        body: { blockedURI: "inline", effectiveDirective: "style-src-elem", documentURL: "https://setupsheet.app/" },
      },
    ]);

    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("returns 204 for malformed JSON rather than an error", async () => {
    const response = await postJson("{not json");
    expect(response.status).toBe(204);
  });

  it("returns 204 for an empty object and logs nothing", async () => {
    const response = await postJson({});
    expect(response.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("truncates oversized attacker-supplied fields instead of logging them whole", async () => {
    const huge = "a".repeat(50_000);
    await postJson({ "csp-report": { "blocked-uri": huge, "violated-directive": "script-src" } });

    const logged = loggedPayload(warn.mock.calls[0]);
    expect(logged.length).toBeLessThan(4000);
    expect(logged).toContain("…");
  });

  it("ignores unexpected fields instead of copying them through", async () => {
    await postJson({
      "csp-report": { "violated-directive": "script-src", secret: "token-abc-123" },
    });

    expect(loggedPayload(warn.mock.calls[0])).not.toContain("token-abc-123");
  });

  it("caps how many array reports it will process", async () => {
    const entries = Array.from({ length: 500 }, () => ({
      type: "csp-violation",
      body: { blockedURI: "https://evil.example/x", effectiveDirective: "script-src" },
    }));

    const response = await postJson(entries);
    expect(response.status).toBe(204);
    expect(warn.mock.calls.length).toBeGreaterThan(0);
    expect(warn.mock.calls.length).toBeLessThanOrEqual(20);
  });
});
