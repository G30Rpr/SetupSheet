import { request as httpRequest, type ClientRequest } from "node:http";
import { test, expect } from "@playwright/test";

// Real incomplete uploads expose middleware buffering that a mocked Request
// stream cannot. These public probes never submit a complete report or write data.
for (const [path, prefix, expected] of [
  ["/api/telemetry", '{"events":[', 408],
  ["/api/csp-report", '{"csp-report":', 204],
] as const) {
  test(`${path} bounds a stalled HTTP upload`, async ({ baseURL }) => {
    test.setTimeout(20_000);
    let upload: ClientRequest | undefined;
    const began = performance.now();
    try {
      const response = await new Promise<{
        status: number | undefined;
        cacheControl: string | undefined;
      }>((resolve, reject) => {
        upload = httpRequest(new URL(path, baseURL), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": 100,
          },
        });
        upload.on("response", (incoming) => {
          incoming.resume();
          resolve({
            status: incoming.statusCode,
            cacheControl: incoming.headers["cache-control"],
          });
        });
        upload.on("error", reject);
        upload.setTimeout(10_000, () => {
          upload?.destroy(new Error("Reporting upload exceeded its deadline"));
        });
        upload.flushHeaders();
        upload.write(prefix);
        // Deliberately keep the request open with fewer than 100 bytes sent.
      });
      expect(response.status).toBe(expected);
      expect(response.cacheControl).toBe("no-store");
      expect(performance.now() - began).toBeGreaterThanOrEqual(4_500);
      expect(performance.now() - began).toBeLessThan(9_000);
    } finally {
      upload?.destroy();
    }
  });
}
