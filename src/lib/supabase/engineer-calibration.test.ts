import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPublicClientMock, loggerErrorMock } = vi.hoisted(() => ({
  createPublicClientMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("@/lib/supabase/public", () => ({ createPublicClient: createPublicClientMock }));
vi.mock("@/lib/logger", () => ({ logger: { error: loggerErrorMock } }));

import { getPublicEngineerCalibration } from "@/lib/supabase/engineer-calibration";

const aggregateRow = {
  game: "Assetto Corsa Competizione",
  condition: "Dry",
  parameter: "Rear wing",
  direction: "increase",
  supporting_setup_count: 5,
  directions: ["increase"],
};

function makeQuery(result: Record<string, unknown>) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  return query;
}

describe("public Engineer calibration query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads only the sanitized aggregate for an exact supported game and condition", async () => {
    const query = makeQuery({ data: [aggregateRow], count: 1, error: null });
    const from = vi.fn(() => query);
    createPublicClientMock.mockReturnValue({ from });

    const result = await getPublicEngineerCalibration("Assetto Corsa Competizione", "dry");

    expect(result.status).toBe("available");
    expect(result.factors).toEqual([
      expect.objectContaining({
        game: "Assetto Corsa Competizione",
        condition: "dry",
        parameter: "Rear wing",
        direction: "increase",
        sampleCount: 5,
      }),
    ]);
    expect(from).toHaveBeenCalledWith("engineer_calibration_evidence");
    expect(query.select).toHaveBeenCalledWith(
      "game, condition, parameter, direction, supporting_setup_count, directions",
      { count: "exact" }
    );
    expect(query.eq).toHaveBeenNthCalledWith(1, "game", "Assetto Corsa Competizione");
    expect(query.eq).toHaveBeenNthCalledWith(2, "condition", "Dry");
    expect(query.limit).toHaveBeenCalledWith(500);
  });

  it("skips unsupported inputs without touching the public database", async () => {
    await expect(getPublicEngineerCalibration("Gran Turismo 7", "dry")).resolves.toEqual({
      status: "available",
      factors: [],
    });
    await expect(getPublicEngineerCalibration("Assetto Corsa Competizione", "Mixed")).resolves.toEqual({
      status: "available",
      factors: [],
    });
    expect(createPublicClientMock).not.toHaveBeenCalled();
  });

  it("fails closed on query errors, thrown errors, and incomplete bounded results", async () => {
    const queryError = makeQuery({ data: null, count: null, error: { message: "unavailable" } });
    createPublicClientMock.mockReturnValue({ from: vi.fn(() => queryError) });
    await expect(getPublicEngineerCalibration("Assetto Corsa Competizione", "dry")).resolves.toEqual({
      status: "unavailable",
      factors: [],
    });

    const incomplete = makeQuery({ data: [aggregateRow], count: 501, error: null });
    createPublicClientMock.mockReturnValue({ from: vi.fn(() => incomplete) });
    await expect(getPublicEngineerCalibration("Assetto Corsa Competizione", "dry")).resolves.toEqual({
      status: "unavailable",
      factors: [],
    });

    createPublicClientMock.mockImplementation(() => {
      throw new Error("network failure");
    });
    await expect(getPublicEngineerCalibration("Assetto Corsa Competizione", "dry")).resolves.toEqual({
      status: "unavailable",
      factors: [],
    });
    expect(loggerErrorMock).toHaveBeenCalledTimes(3);
  });
});
