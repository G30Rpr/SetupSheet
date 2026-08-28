import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSetupsByUserPage } from "@/lib/supabase/setups";
import { loadMoreProfileSetups } from "@/lib/actions/profile-browse";

vi.mock("@/lib/supabase/setups", () => ({
  getSetupsByUserPage: vi.fn(),
}));

const validProfileId = "11111111-1111-4111-8111-111111111111";
const validCursor = {
  createdAt: "2026-08-27T00:00:00.000Z",
  id: "22222222-2222-4222-8222-222222222222",
};

describe("loadMoreProfileSetups", () => {
  beforeEach(() => {
    vi.mocked(getSetupsByUserPage).mockReset();
  });

  it("rejects malformed profile ids and cursors before querying", async () => {
    await expect(loadMoreProfileSetups("not-a-uuid", validCursor)).resolves.toEqual({
      setups: [],
      nextCursor: null,
      error: "That profile page request is invalid.",
    });

    await expect(
      loadMoreProfileSetups(validProfileId, { ...validCursor, createdAt: "not-a-date" })
    ).resolves.toEqual({
      setups: [],
      nextCursor: null,
      error: "That profile page request is invalid.",
    });

    await expect(
      loadMoreProfileSetups(validProfileId, { ...validCursor, id: "not-a-uuid" })
    ).resolves.toEqual({
      setups: [],
      nextCursor: null,
      error: "That profile page request is invalid.",
    });

    expect(getSetupsByUserPage).not.toHaveBeenCalled();
  });

  it("delegates valid requests and returns the page result", async () => {
    const page = { setups: [], nextCursor: null, error: null };
    vi.mocked(getSetupsByUserPage).mockResolvedValue(page);

    await expect(loadMoreProfileSetups(validProfileId, validCursor)).resolves.toEqual(page);
    expect(getSetupsByUserPage).toHaveBeenCalledWith(validProfileId, validCursor);
  });

  it("turns unexpected database failures into a recoverable error", async () => {
    vi.mocked(getSetupsByUserPage).mockRejectedValue(new Error("network failure"));

    await expect(loadMoreProfileSetups(validProfileId, validCursor)).resolves.toEqual({
      setups: [],
      nextCursor: null,
      error: "Couldn't load more profile setups right now.",
    });
  });
});
