import { expect, test } from "@playwright/test";

test("requests board reports an unreachable database instead of an empty board", async ({
  page,
}) => {
  await page.goto("/requests");

  await expect(page.getByRole("heading", { name: "Setup Requests" })).toBeVisible();

  // No live Supabase project is reachable here, so getSetupRequestsPage() and
  // getMostWantedRequests() both fail.
  //
  // This page used to render the "No requests yet" empty state *and* the
  // failure message at the same time, which made an outage look like a quiet
  // board ("nobody has posted yet, be the first"). The failure now owns the
  // state and offers a retry, so the two assertions below are what keeps that
  // regression from coming back: the outage copy must be present, and the
  // empty-board copy must not.
  await expect(page.getByText("Couldn't load the requests board")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByText("No requests yet")).toHaveCount(0);

  // Logged out, so the form renders its "log in to post" gate rather than
  // the real game/car/track/notes fields.
  await expect(page.getByText("Log in to post a setup request.")).toBeVisible();
});

test("nav includes a link to the requests board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Requests" }).first()).toBeVisible();
});
