import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSetup, rateSetup, toggleUpvote } from "@/lib/actions/setups";
import { AUTHOR_NOTE_REQUIRED_ERROR } from "@/lib/validate-setup-fields";

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

describe("rateSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validSetupId = "11111111-1111-4111-8111-111111111111";

  function makeRateSupabase(options: { setupOwnerId?: string; upsertError?: unknown }) {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: options.setupOwnerId ? { user_id: options.setupOwnerId } : null,
      error: null,
    });
    const eq2 = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq: eq2 });

    const upsert = vi.fn().mockResolvedValue({ error: options.upsertError ?? null });

    return {
      from: vi.fn((table: string) => {
        if (table === "setups") return { select };
        if (table === "setup_ratings") return { upsert };
        return {};
      }),
      upsert,
    };
  }

  it("rejects unauthenticated calls", async () => {
    const supabase = makeRateSupabase({});
    createClientMock.mockResolvedValue(supabase);
    getCurrentUserMock.mockResolvedValue(null);

    await expect(rateSetup(validSetupId, 4, 4)).resolves.toEqual({
      error: "You need to be logged in with Discord to rate a setup.",
    });
    expect(supabase.upsert).not.toHaveBeenCalled();
  });

  it("blocks authors from rating their own setups (DB is the backstop)", async () => {
    const supabase = makeRateSupabase({ setupOwnerId: "user-1" });
    createClientMock.mockResolvedValue(supabase);
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });

    await expect(rateSetup(validSetupId, 5, 5)).resolves.toEqual({
      error: "You can't rate your own setup.",
    });
    expect(supabase.upsert).not.toHaveBeenCalled();
  });

  it("accepts ratings from other drivers", async () => {
    const supabase = makeRateSupabase({ setupOwnerId: "other-user" });
    createClientMock.mockResolvedValue(supabase);
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });

    await expect(rateSetup(validSetupId, 4, 3)).resolves.toEqual({ error: null });
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", setup_id: validSetupId, pace: 4, predictability: 3 }),
      { onConflict: "user_id,setup_id" }
    );
  });

  it("rejects out-of-range ratings", async () => {
    const supabase = makeRateSupabase({ setupOwnerId: "other-user" });
    createClientMock.mockResolvedValue(supabase);
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });

    await expect(rateSetup(validSetupId, 0, 3)).resolves.toEqual({
      error: "Pace and Predictability must be whole numbers from 1 to 5.",
    });
    expect(supabase.upsert).not.toHaveBeenCalled();
  });

  it("stores the rater's rig alongside the rating", async () => {
    const supabase = makeRateSupabase({ setupOwnerId: "other-user" });
    createClientMock.mockResolvedValue(supabase);
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });

    await expect(rateSetup(validSetupId, 4, 3, "Gamepad")).resolves.toEqual({ error: null });
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", rater_rig: "Gamepad" }),
      { onConflict: "user_id,setup_id" }
    );
  });

  it("stores null when the rig is missing or not a real profile", async () => {
    const supabase = makeRateSupabase({ setupOwnerId: "other-user" });
    createClientMock.mockResolvedValue(supabase);
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });

    await rateSetup(validSetupId, 4, 3, "Steering Wheel Only");
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ rater_rig: null }),
      { onConflict: "user_id,setup_id" }
    );

    await rateSetup(validSetupId, 4, 3);
    expect(supabase.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ rater_rig: null }),
      { onConflict: "user_id,setup_id" }
    );
  });
});

describe("createSetup author note", () => {
  const baseCreateInput = {
    game: "iRacing",
    car: "Porsche 911 GT3 Cup",
    track: "Spa",
    condition: "Dry",
    description: "",
    tags: ["Safe"],
    rigProfile: "Wheel + 3 Pedals",
    lapTime: "",
  };

  it("rejects uploads without an author note before touching the database", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    const rpc = vi.fn();
    createClientMock.mockResolvedValue({ rpc });

    const result = await createSetup({ ...baseCreateInput, description: "   " });

    expect(result.error).toBe(AUTHOR_NOTE_REQUIRED_ERROR);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("lets a noted upload through to the create RPC", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    createClientMock.mockResolvedValue({ rpc });

    const result = await createSetup({
      ...baseCreateInput,
      description: "Likes a planted rear. Hates kerbs. Softened the ARB one click.",
    });

    expect(rpc).toHaveBeenCalledOnce();
    expect(result.error).not.toBeNull();
  });
});
