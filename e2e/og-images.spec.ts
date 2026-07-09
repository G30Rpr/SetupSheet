import { expect, test } from "@playwright/test";

test("default OG image route returns a PNG", async ({ request }) => {
  const response = await request.get("/opengraph-image");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
});

test("per-setup OG image route returns a PNG, including the not-found fallback", async ({
  request,
}) => {
  // No reachable Supabase here, so getSetupById always returns null --
  // this exercises the route's "Setup not found" fallback ImageResponse,
  // which still renders a valid 200 PNG rather than erroring.
  const response = await request.get(
    "/setups/00000000-0000-0000-0000-000000000000/opengraph-image"
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
});
