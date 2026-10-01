import { expect, test } from "@playwright/test";

test("default OG image route returns a PNG", async ({ request }) => {
  const response = await request.get("/opengraph-image");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
});

test("malformed per-setup OG image IDs are rejected before rendering", async ({ request }) => {
  const response = await request.get("/setups/not-a-uuid/opengraph-image");
  expect(response.status()).toBe(404);
  expect(await response.body()).toHaveLength(0);
});
