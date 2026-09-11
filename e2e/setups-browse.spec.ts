import { expect, test } from "@playwright/test";

test("browse page renders empty state and filter controls with no reachable Supabase", async ({
  page,
}) => {
  await page.goto("/setups");

  await expect(page.getByRole("heading", { name: "Browse Setups" })).toBeVisible();

  // No live Supabase project is reachable here, so getSetups() always
  // returns [] -- this is the "No setups yet" branch, not the
  // "no setups match your filters" branch.
  await expect(page.getByText("No setups yet")).toBeVisible();

  for (const label of ["Game", "Car", "Track", "Condition", "Rig"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }

  // Targeted by id on purpose: the search box is also a combobox
  // (aria-controls="setup-search-suggestions"), and it comes first in the DOM,
  // so getByRole("combobox").first() clicks *that*, and with no setups data its
  // suggestion listbox stays empty -- the assertion below then fails for the
  // wrong reason.
  const gameTrigger = page.locator("#filter-game");
  await gameTrigger.click();
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Escape");
});
