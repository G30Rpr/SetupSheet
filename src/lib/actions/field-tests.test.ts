import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFieldTestReport, setFieldTestReportAttribution } from "@/lib/actions/field-tests";

const { createClientMock, getCurrentUserMock, revalidatePathMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/supabase/auth", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const SESSION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SETUP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REPORT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function makeSupabase(result: { data?: unknown; error?: unknown }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? REPORT_ID, error: result.error ?? null });
  return { client: { rpc }, rpc };
}

describe("Field-test Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("submits only the session ID, setup ID, and private note", async () => {
    const { client, rpc } = makeSupabase({ data: REPORT_ID });
    createClientMock.mockResolvedValue(client);

    await expect(createFieldTestReport({
      garageSessionId: SESSION_ID,
      setupId: SETUP_ID,
      note: "  Clean run  ",
    })).resolves.toEqual({ reportId: REPORT_ID, error: null });

    expect(rpc).toHaveBeenCalledWith("create_field_test_report", {
      p_garage_session_id: SESSION_ID,
      p_setup_id: SETUP_ID,
      p_note: "Clean run",
    });
  });

  it("rejects client-supplied metrics before reaching Supabase", async () => {
    const { client, rpc } = makeSupabase({ data: REPORT_ID });
    createClientMock.mockResolvedValue(client);

    await expect(createFieldTestReport({
      garageSessionId: SESSION_ID,
      setupId: SETUP_ID,
      note: "",
      lapsRun: 99,
      bestLapMs: 1,
    })).resolves.toMatchObject({ reportId: null, error: expect.stringMatching(/invalid/i) });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns a stable duplicate-per-UTC-day message", async () => {
    const { client } = makeSupabase({ data: null, error: { code: "23505", message: "duplicate" } });
    createClientMock.mockResolvedValue(client);

    await expect(createFieldTestReport({
      garageSessionId: SESSION_ID,
      setupId: SETUP_ID,
      note: "",
    })).resolves.toEqual({
      reportId: null,
      error: "You already submitted a field test for this setup today (UTC).",
    });
  });

  it("changes attribution through a separate owner-scoped RPC without accepting a name", async () => {
    const { client, rpc } = makeSupabase({ data: undefined });
    createClientMock.mockResolvedValue(client);

    await expect(setFieldTestReportAttribution({ reportId: REPORT_ID, showName: true })).resolves.toEqual({
      error: null,
    });
    expect(rpc).toHaveBeenCalledWith("set_field_test_report_attribution", {
      p_report_id: REPORT_ID,
      p_show_name: true,
    });

    await expect(setFieldTestReportAttribution({
      reportId: REPORT_ID,
      showName: true,
      displayName: "forged name",
    })).resolves.toMatchObject({ error: expect.stringMatching(/invalid/i) });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
