import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  submitContentReport,
  type ContentReportInput,
} from "@/lib/actions/content-reports";

const { createClientMock, getCurrentUserMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/supabase/auth", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const validInput: ContentReportInput = {
  targetType: "setup",
  targetId: "11111111-1111-4111-8111-111111111111",
  reason: "spam",
  details: "Misleading setup details",
};

function makeSupabase(insertResult: { error?: unknown }) {
  const insert = vi.fn().mockResolvedValue(insertResult);
  return { from: vi.fn().mockReturnValue({ insert }), insert };
}

describe("submitContentReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects malformed targets and reasons before touching Supabase", async () => {
    await expect(
      submitContentReport({ ...validInput, targetId: "not-a-uuid" })
    ).resolves.toEqual({ error: "Invalid report." });
    await expect(
      submitContentReport({ ...validInput, reason: "unknown" as ContentReportInput["reason"] })
    ).resolves.toEqual({ error: "Invalid report." });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("inserts a report for the authenticated user", async () => {
    const supabase = makeSupabase({ error: null });
    createClientMock.mockResolvedValue(supabase);
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });

    await expect(submitContentReport(validInput)).resolves.toEqual({ error: null });
    expect(supabase.insert).toHaveBeenCalledWith({
      reporter_id: "user-1",
      target_type: "setup",
      target_id: validInput.targetId,
      reason: "spam",
      details: validInput.details,
    });
  });

  it("returns a stable duplicate-report message", async () => {
    const supabase = makeSupabase({ error: { code: "23505" } });
    createClientMock.mockResolvedValue(supabase);
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });

    await expect(submitContentReport(validInput)).resolves.toEqual({
      error: "You already have an active report for this content.",
    });
  });
});
