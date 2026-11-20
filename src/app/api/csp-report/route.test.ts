import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { sampleLog } = vi.hoisted(() => ({
  sampleLog: vi.fn((): number | null => 1),
}));
vi.mock("@/lib/report-log-sampling", () => ({ sampleReportLog: sampleLog }));

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
    }),
  );
}

describe("POST /api/csp-report", () => {
  // Re-created per test: a single describe-scoped spy is restored by the first
  // afterEach, after which later tests silently observe nothing.
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sampleLog.mockReturnValue(1);
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    vi.useRealTimers();
  });

  it("discards a stalled report with an uncached 204 even if cancellation stalls", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"csp-report":'));
      },
      cancel: () => new Promise<void>(() => {}),
    });
    const pending = POST(
      new Request("https://setupsheet.app/api/csp-report", {
        method: "POST",
        body,
        duplex: "half",
      } as RequestInit & { duplex: "half" }),
    );
    await vi.advanceTimersByTimeAsync(5_000);
    const response = await pending;
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(warn).not.toHaveBeenCalled();
    expect(body.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not log an unsampled report", async () => {
    sampleLog.mockReturnValue(null);
    const response = await postJson({
      "csp-report": { "violated-directive": "script-src" },
    });
    expect(response.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("redacts unknown paths, asset names, directive details and non-scalar line numbers", async () => {
    const response = await postJson({
      "csp-report": {
        "violated-directive":
          "script-src 'nonce-private-nonce' https://example.com/private-token",
        "document-uri": "https://setupsheet.app/private-token?code=oauth-code",
        "source-file":
          "https://setupsheet.app/_next/static/chunks/private-filename.js",
        "line-number": { toString: null, secret: "private-line-value" },
      },
    });
    expect(response.status).toBe(204);
    const logged = loggedPayload(warn.mock.calls[0]);
    expect(logged).toContain("script-src");
    expect(logged).toContain("/:redacted");
    expect(logged).toContain("/_next/static/:asset");
    expect(logged).not.toMatch(/private-|oauth-code/);
  });

  it.each(["42", 42])("accepts a scalar line number %j", async (lineNumber) => {
    await postJson({ "csp-report": { "line-number": lineNumber } });
    expect(loggedPayload(warn.mock.calls[0])).toContain('"lineNumber":42');
  });

  it("normalizes public IDs and drops arbitrary protocol labels", async () => {
    await postJson({
      "csp-report": {
        "document-uri":
          "https://setupsheet.app/profile/11111111-1111-4111-8111-111111111111",
        "blocked-uri": "private-secret-token:payload",
      },
    });
    const logged = loggedPayload(warn.mock.calls[0]);
    expect(logged).toContain("/profile/:id");
    expect(logged).toContain("other:");
    expect(logged).not.toContain("11111111");
    expect(logged).not.toContain("private-secret-token");
  });

  it.each([true, -4, "12secret", null, { toString: null }])(
    "drops an invalid line number %j",
    async (lineNumber) => {
      const response = await postJson({
        "csp-report": { "line-number": lineNumber },
      });
      expect(response.status).toBe(204);
      expect(loggedPayload(warn.mock.calls[0])).not.toContain('"lineNumber"');
    },
  );

  it.each(["text", 17, [], true])(
    "ignores a non-object report %j",
    async (report) => {
      const response = await postJson({ "csp-report": report });
      expect(response.status).toBe(204);
      expect(warn).not.toHaveBeenCalled();
    },
  );

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
        body: {
          blockedURI: "inline",
          effectiveDirective: "style-src-elem",
          documentURL: "https://setupsheet.app/",
        },
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

  it("bounds field lengths and skips request bodies over the byte ceiling", async () => {
    const longButBounded = "a".repeat(700);
    await postJson({ "csp-report": { "violated-directive": longButBounded } });

    const logged = loggedPayload(warn.mock.calls[0]);
    expect(logged.length).toBeLessThan(2000);
    expect(logged).toContain("unknown");
    expect(logged).not.toContain(longButBounded.slice(0, 50));

    warn.mockClear();
    const oversized = await postJson({
      "csp-report": { "violated-directive": "x".repeat(20_000) },
    });
    expect(oversized.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("redacts query strings and external URL paths before logging", async () => {
    await postJson({
      "csp-report": {
        "blocked-uri": "https://evil.example/user/secret?token=do-not-log",
        "document-uri":
          "https://setupsheet.app/auth/callback?code=oauth-secret",
      },
    });

    const logged = loggedPayload(warn.mock.calls[0]);
    expect(logged).toContain("https://evil.example");
    expect(logged).not.toContain("/user/secret");
    expect(logged).toContain("https://setupsheet.app/auth/callback");
    expect(logged).not.toContain("oauth-secret");
    expect(logged).not.toContain("do-not-log");
  });

  it("ignores unexpected fields instead of copying them through", async () => {
    await postJson({
      "csp-report": {
        "violated-directive": "script-src",
        secret: "token-abc-123",
      },
    });

    expect(loggedPayload(warn.mock.calls[0])).not.toContain("token-abc-123");
  });

  it("caps how many array reports it will process", async () => {
    const entries = Array.from({ length: 25 }, () => ({
      type: "csp-violation",
      body: {
        blockedURI: "https://evil.example/x",
        effectiveDirective: "script-src",
      },
    }));

    const response = await postJson(entries);
    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledOnce();
    const logged = JSON.parse(loggedPayload(warn.mock.calls[0])) as {
      error: { reports: unknown[]; sampleRate: number };
    };
    expect(logged.error.reports).toHaveLength(20);
    expect(logged.error.sampleRate).toBe(1);
  });
});
