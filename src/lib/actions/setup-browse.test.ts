import { describe, expect, it } from "vitest";

import { loadMoreSetups } from "@/lib/actions/setup-browse";

const validCursor = {
  createdAt: "2026-08-27T00:00:00.000Z",
  id: "11111111-1111-4111-8111-111111111111",
};

describe("loadMoreSetups", () => {
  it("rejects malformed cursors before touching the database", async () => {
    await expect(loadMoreSetups({ ...validCursor, createdAt: "not-a-date" })).resolves.toEqual({
      setups: [],
      nextCursor: null,
      error: "That browse cursor is invalid.",
    });
  });

  it("rejects cursor text that is not a strict ISO timestamp", async () => {
    await expect(
      loadMoreSetups({
        ...validCursor,
        createdAt: "2026-08-27T00:00:00.000Z,or(id.eq.secret)",
      })
    ).resolves.toMatchObject({
      setups: [],
      nextCursor: null,
      error: "That browse cursor is invalid.",
    });
  });

  it("rejects oversized or malformed cursor ids", async () => {
    await expect(
      loadMoreSetups({ ...validCursor, createdAt: "x".repeat(65) })
    ).resolves.toMatchObject({
      setups: [],
      nextCursor: null,
      error: "That browse cursor is invalid.",
    });
    await expect(
      loadMoreSetups({ ...validCursor, id: "not-a-uuid" })
    ).resolves.toMatchObject({
      setups: [],
      nextCursor: null,
      error: "That browse cursor is invalid.",
    });
  });
});
