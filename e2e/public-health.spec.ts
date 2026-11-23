import { expect, test } from "@playwright/test";

test("health probe is routed and non-cacheable even with an unrelated auth cookie", async ({
  request,
}) => {
  const response = await request.get("/api/health", {
    headers: { Cookie: "sb-unrelated-auth-token=unrelated-session" },
    timeout: 10_000,
  });
  expect([200, 503]).toContain(response.status());
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({
    status: response.status() === 200 ? "ok" : "unavailable",
  });
  if (process.env.NEXT_PUBLIC_SUPABASE_URL === "https://127.0.0.1:54321") {
    expect(response.status()).toBe(503);
  }
});
