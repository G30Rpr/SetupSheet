import { describe, expect, it } from "vitest";

import { isSameOriginRequest } from "@/lib/request-origin";

describe("isSameOriginRequest", () => {
  it("uses the public forwarded host and scheme behind a reverse proxy", () => {
    const request = new Request("http://0.0.0.0:3012/api/telemetry", {
      headers: {
        host: "0.0.0.0:3012",
        "x-forwarded-host": "setupsheet.app",
        "x-forwarded-proto": "https",
      },
    });

    expect(isSameOriginRequest(request, "https://setupsheet.app")).toBe(true);
    expect(isSameOriginRequest(request, "https://attacker.example")).toBe(false);
  });

  it("falls back to Host and the request scheme when forwarded headers are absent", () => {
    const request = new Request("http://internal:3000/api/telemetry", {
      headers: { host: "localhost:3000" },
    });

    expect(isSameOriginRequest(request, "http://localhost:3000")).toBe(true);
    expect(isSameOriginRequest(request, "https://localhost:3000")).toBe(false);
  });

  it("rejects invalid or opaque origins", () => {
    const request = new Request("https://setupsheet.app/api/telemetry", {
      headers: { host: "setupsheet.app" },
    });

    expect(isSameOriginRequest(request, "null")).toBe(false);
    expect(isSameOriginRequest(request, "not a url")).toBe(false);
  });
});
