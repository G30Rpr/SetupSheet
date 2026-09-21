import { expect, test } from "@playwright/test";

test("browse page reports an unreachable database instead of an empty library", async ({
  page,
}) => {
  await page.goto("/setups");

  await expect(page.getByRole("heading", { name: "Browse Setups" })).toBeVisible();

  // No live Supabase project is reachable here. getSetups() now reports the
  // failure rather than collapsing it into [], because an empty grid that
  // says "No setups yet -- be the first to share one" is indistinguishable
  // from a healthy-but-new community. The outage copy must be present, the
  // empty-library copy must not, and the "0 setups found" count must be
  // suppressed while the read is failing (it reads as a filter problem).
  await expect(page.getByText("Couldn't load setups")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByText("No setups yet")).toHaveCount(0);
  await expect(page.getByText(/setups found/)).toHaveCount(0);

  // Filters stay usable during an outage -- they're the recovery path once the
  // read succeeds again.
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
