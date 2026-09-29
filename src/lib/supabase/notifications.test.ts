import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getNotifications } from "@/lib/supabase/notifications";

const SETUP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REPORT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function query(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
    in: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

describe("field-test notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses only opted-in public attribution and never loads the reporter profile", async () => {
    const notificationsQuery = query({
      data: [{
        id: "notification-1",
        type: "field_test",
        actor_id: "private-user-id",
        setup_id: SETUP_ID,
        field_test_report_id: REPORT_ID,
        read: false,
        created_at: "2026-09-20T10:45:00.000Z",
      }],
      error: null,
    });
    const setupQuery = query({ data: [{ id: SETUP_ID, car: "BMW M4 GT3", track: "Monza" }], error: null });
    const reportQuery = query({ data: [{ report_id: REPORT_ID, display_name: null }], error: null });
    const from = vi.fn((table: string) => {
      if (table === "notifications") return notificationsQuery;
      if (table === "setups") return setupQuery;
      if (table === "field_test_reports_public") return reportQuery;
      throw new Error(`Unexpected query for ${table}`);
    });
    createClientMock.mockResolvedValue({ from });

    const result = await getNotifications("setup-owner");

    expect(result).toEqual([{
      id: "notification-1",
      type: "field_test",
      actorId: null,
      actorUsername: "Anonymous driver",
      actorAvatarUrl: null,
      setupId: SETUP_ID,
      car: "BMW M4 GT3",
      track: "Monza",
      read: false,
      createdAt: "2026-09-20T10:45:00.000Z",
    }]);
    expect(from).not.toHaveBeenCalledWith("profiles");
    expect(reportQuery.select).toHaveBeenCalledWith("report_id, display_name");
  });
});
