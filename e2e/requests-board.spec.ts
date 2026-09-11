import { expect, test } from "@playwright/test";

test("requests board renders empty state and post-a-request form with no reachable Supabase", async ({
  page,
}) => {
  await page.goto("/requests");

  await expect(page.getByRole("heading", { name: "Setup Requests" })).toBeVisible();

  // No live Supabase project is reachable here, so getSetupRequestsPage()
  // and getMostWantedRequests() both return [] -- the "no requests yet"
  // empty state, not a populated list.
  await expect(page.getByText("No requests yet")).toBeVisible();

  // Logged out, so the form renders its "log in to post" gate rather than
  // the real game/car/track/notes fields.
  await expect(page.getByText("Log in to post a setup request.")).toBeVisible();
});

test("nav includes a link to the requests board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Requests" }).first()).toBeVisible();
});
