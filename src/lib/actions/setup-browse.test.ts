import { describe, expect, it } from "vitest";

import { ALL_BROWSE_FILTER } from "@/lib/browse-filters";
import { loadMoreSetups } from "@/lib/actions/setup-browse";

const validCursor = {
  createdAt: "2026-08-27T00:00:00.000Z",
  id: "11111111-1111-4111-8111-111111111111",
};
const validFilters = {
  search: "",
  game: ALL_BROWSE_FILTER,
  car: ALL_BROWSE_FILTER,
  track: ALL_BROWSE_FILTER,
  condition: ALL_BROWSE_FILTER,
  rig: ALL_BROWSE_FILTER,
};

describe("loadMoreSetups", () => {
  it("rejects malformed cursors before touching the database", async () => {
    await expect(
      loadMoreSetups({ ...validCursor, createdAt: "not-a-date" }, validFilters)
    ).resolves.toEqual({
      setups: [],
      nextCursor: null,
      fieldTestCounts: {},
      error: "That browse cursor is invalid.",
    });
  });

  it("rejects oversized or malformed cursor ids", async () => {
    await expect(
      loadMoreSetups({ ...validCursor, createdAt: "x".repeat(65) }, validFilters)
    ).resolves.toMatchObject({
      setups: [],
      nextCursor: null,
      error: "That browse cursor is invalid.",
    });
    await expect(
      loadMoreSetups({ ...validCursor, id: "not-a-uuid" }, validFilters)
    ).resolves.toMatchObject({
      setups: [],
      nextCursor: null,
      error: "That browse cursor is invalid.",
    });
  });

  it("rejects malformed server-side filters", async () => {
    await expect(
      loadMoreSetups(validCursor, { ...validFilters, game: "Unknown game" })
    ).resolves.toMatchObject({
      setups: [],
      nextCursor: null,
      error: "That browse cursor is invalid.",
    });
  });
});
