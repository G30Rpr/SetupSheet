import { beforeEach, describe, expect, it, vi } from "vitest";

import { toggleUpvote } from "@/lib/actions/setups";

const { createClientMock, getCurrentUserMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/supabase/auth", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

function makeSupabase(options: {
  setupOwnerId?: string;
  insertError?: unknown;
  deleteError?: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.setupOwnerId ? { user_id: options.setupOwnerId } : null,
    error: null,
  });
  const eq2 = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: eq2 });

  const deleteEq2 = vi.fn().mockResolvedValue({ error: options.deleteError ?? null });
  const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });
  const del = vi.fn().mockReturnValue({ eq: deleteEq1 });

  const insert = vi.fn().mockResolvedValue({ error: options.insertError ?? null });

  return {
    from: vi.fn((table: string) => {
      if (table === "setups") {
        return { select };
      }
      if (table === "setup_upvotes") {
        return { delete: del, insert };
      }
      return {};
    }),
    insert,
    del,
  };
}

describe("toggleUpvote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validSetupId = "11111111-1111-4111-8111-111111111111";

  it("rejects unauthenticated calls", async () => {
    const supabase = makeSupabase({});
    createClientMock.mockResolvedValue(supabase);
    getCurrentUserMock.mockResolvedValue(null);

    await expect(toggleUpvote(validSetupId, false)).resolves.toEqual({
      error: "You need to be logged in with Discord to upvote.",
    });
  });

  it("rejects invalid setup IDs", async () => {
    const supabase = makeSupabase({});
    createClientMock.mockResolvedValue(supabase);
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });

    await expect(toggleUpvote("not-a-uuid", false)).resolves.toEqual({
      error: "That upvote request is invalid.",
    });
  });

  it("prevents users from upvoting their own setups", async () => {
    const supabase = makeSupabase({ setupOwnerId: "user-1" });
    createClientMock.mockResolvedValue(supabase);
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });

    await expect(toggleUpvote(validSetupId, false)).resolves.toEqual({
      error: "You can't upvote your own setup.",
    });
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("allows users to upvote setups created by others", async () => {
    const supabase = makeSupabase({ setupOwnerId: "other-user" });
    createClientMock.mockResolvedValue(supabase);
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });

    await expect(toggleUpvote(validSetupId, false)).resolves.toEqual({
      error: null,
    });
    expect(supabase.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      setup_id: validSetupId,
    });
  });

  it("allows users to remove an existing upvote", async () => {
    const supabase = makeSupabase({});
    createClientMock.mockResolvedValue(supabase);
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });

    await expect(toggleUpvote(validSetupId, true)).resolves.toEqual({
      error: null,
    });
    expect(supabase.del).toHaveBeenCalled();
  });
});
