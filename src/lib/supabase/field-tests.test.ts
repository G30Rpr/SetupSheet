import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPublicClientMock } = vi.hoisted(() => ({ createPublicClientMock: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: createPublicClientMock }));

import { getPublicFieldTestCounts, getPublicFieldTestSummary } from "@/lib/supabase/field-tests";

const SETUP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REPORT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function makeQuery(result: Record<string, unknown>) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(result)),
    in: vi.fn(() => Promise.resolve(result)),
  };
  return query;
}

describe("public field-test queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps only sanitized rows from the public projection", async () => {
    const query = makeQuery({
      data: [{
        report_id: REPORT_ID,
        setup_id: SETUP_ID,
        game: "Assetto Corsa Competizione",
        condition: "Dry",
        validated_changes: [{ parameter: "Rear wing", direction: "increase", amount: "1 click" }],
        laps_run: 3,
        consistency_pct: 99.1,
        best_lap_ms: 102350,
        created_at: "2026-09-20T10:45:00.000Z",
        display_name: "Driver",
      }],
      count: 7,
      error: null,
    });
    const from = vi.fn(() => query);
    createPublicClientMock.mockReturnValue({ from });

    const result = await getPublicFieldTestSummary(SETUP_ID, 5);

    expect(result).toEqual({
      reportCount: 7,
      error: false,
      reports: [{
        id: REPORT_ID,
        setupId: SETUP_ID,
        game: "Assetto Corsa Competizione",
        condition: "Dry",
        validatedChanges: [{ parameter: "Rear wing", direction: "increase", amount: "1 click" }],
        lapsRun: 3,
        consistencyPct: 99.1,
        bestLapMs: 102350,
        createdAt: "2026-09-20T10:45:00.000Z",
        displayName: "Driver",
      }],
    });
    expect(query.select).toHaveBeenCalledWith(
      "report_id, setup_id, game, condition, validated_changes, laps_run, consistency_pct, best_lap_ms, created_at, display_name",
      { count: "exact" }
    );
    expect(query.eq).toHaveBeenCalledWith("setup_id", SETUP_ID);
    expect(query.limit).toHaveBeenCalledWith(5);
    expect(result.reports[0]).not.toHaveProperty("garageSessionId");
    expect(result.reports[0]).not.toHaveProperty("userId");
    expect(result.reports[0]).not.toHaveProperty("note");
  });

  it("keeps anonymous rows anonymous and rejects unsafe or non-Engineer projection rows", async () => {
    const query = makeQuery({
      data: [
        {
          report_id: REPORT_ID,
          setup_id: SETUP_ID,
          game: "Le Mans Ultimate",
          condition: "Mixed",
          validated_changes: [],
          laps_run: 1,
          consistency_pct: null,
          best_lap_ms: 102350,
          created_at: "2026-09-20T10:45:00.000Z",
          display_name: null,
        },
        {
          report_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          setup_id: SETUP_ID,
          game: "iRacing",
          condition: "Dry",
          validated_changes: [],
          laps_run: 1,
          consistency_pct: null,
          best_lap_ms: 102350,
          created_at: "2026-09-20T10:45:00.000Z",
          display_name: null,
        },
      ],
      count: 2,
      error: null,
    });
    createPublicClientMock.mockReturnValue({ from: vi.fn(() => query) });

    const result = await getPublicFieldTestSummary(SETUP_ID);
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].displayName).toBeNull();
    expect(result.reports[0].consistencyPct).toBeNull();
    expect(result.reportCount).toBe(2);
  });

  it("uses the aggregate count view for setup-card counts", async () => {
    const query = makeQuery({
      data: [{ setup_id: SETUP_ID, report_count: 4 }],
      error: null,
    });
    createPublicClientMock.mockReturnValue({ from: vi.fn(() => query) });

    const result = await getPublicFieldTestCounts([SETUP_ID, "invalid", SETUP_ID]);

    expect(result).toEqual(new Map([[SETUP_ID, 4]]));
    expect(query.select).toHaveBeenCalledWith("setup_id, report_count");
    expect(query.in).toHaveBeenCalledWith("setup_id", [SETUP_ID]);
  });
});
