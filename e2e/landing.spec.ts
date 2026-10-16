import { expect, test } from "@playwright/test";

test("landing page renders the combo finder and CTAs", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "The setup that fits your rig."
  );

  // The four finder controls, in order: Game, Car, Track, Rig.
  const game = page.getByLabel("Game");
  const car = page.getByLabel("Car");
  const track = page.getByLabel("Track");
  const rig = page.getByLabel("Rig");
  await expect(game).toBeVisible();
  await expect(car).toBeVisible();
  await expect(track).toBeVisible();
  await expect(rig).toBeVisible();

  await expect(page.getByRole("button", { name: "Find a setup" })).toBeVisible();
  await expect(page.getByRole("link", { name: /the car is misbehaving/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Request a setup" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Upload a setup" })).toBeVisible();
  await expect(page).toHaveTitle(/SetupSheet/);
});

test("landing page makes no unprovable community-size claims", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Most upvoted")).toHaveCount(0);
  await expect(page.getByText(/community setups/i)).toHaveCount(0);
  await expect(page.getByText(/sim titles supported/i)).toHaveCount(0);
});

test("finder navigates to browse with the chosen combo in the query string", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Game").click();
  await page.getByRole("option", { name: "Assetto Corsa Competizione" }).click();
  await page.getByLabel("Car").fill("BMW M4 GT3 2021");
  await page.getByLabel("Track").fill("Spa-Francorchamps");
  await page.getByLabel("Rig").click();
  await page.getByRole("option", { name: "Gamepad" }).click();
  await page.getByRole("button", { name: "Find a setup" }).click();

  await expect(page).toHaveURL(
    /\/setups\?game=Assetto\+Corsa\+Competizione&car=BMW\+M4\+GT3\+2021&track=Spa-Francorchamps&rig=Gamepad/
  );
});
