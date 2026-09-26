import { describe, expect, it } from "vitest";

import {
  calculateConsistencyPct,
  deriveFieldTestCondition,
  isEngineerGame,
  parseCreateFieldTestReportInput,
  parseSetFieldTestAttributionInput,
} from "@/lib/field-tests";

describe("field-test input and metric rules", () => {
  it("accepts only the three server-derived report inputs", () => {
    const valid = parseCreateFieldTestReportInput({
      garageSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      setupId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      note: "  Dry run  ",
    });
    expect(valid).toEqual({
      value: {
        garageSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        setupId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        note: "Dry run",
      },
      error: null,
    });
    expect(parseCreateFieldTestReportInput({
      garageSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      setupId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      note: "",
      consistencyPct: 100,
    }).value).toBeNull();
    expect(parseCreateFieldTestReportInput({ garageSessionId: "bad", setupId: "bad", note: "" }).value).toBeNull();
  });

  it("validates report attribution separately from report creation", () => {
    expect(parseSetFieldTestAttributionInput({
      reportId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      showName: false,
    })).toMatchObject({
      value: { reportId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", showName: false },
      error: null,
    });
    expect(parseSetFieldTestAttributionInput({
      reportId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      showName: true,
      userId: "private",
    }).value).toBeNull();
  });

  it("returns null consistency for one lap and the sample-CV score for two or more", () => {
    expect(calculateConsistencyPct([])).toBeNull();
    expect(calculateConsistencyPct([102_350])).toBeNull();
    expect(calculateConsistencyPct([100_000, 100_000])).toBe(100);
    expect(calculateConsistencyPct([100_000, 101_000])).toBe(99.3);
    expect(calculateConsistencyPct([10_000, 1_800_000])).toBe(0);
    expect(calculateConsistencyPct([100_000, 0])).toBeNull();
  });

  it("derives a single logged condition or Mixed for differing lap conditions", () => {
    expect(deriveFieldTestCondition([])).toBeNull();
    expect(deriveFieldTestCondition([
      { lapTimeMs: 100_000, condition: "Dry" },
      { lapTimeMs: 101_000, condition: "Dry" },
    ])).toBe("Dry");
    expect(deriveFieldTestCondition([
      { lapTimeMs: 100_000, condition: "Dry" },
      { lapTimeMs: 101_000, condition: "Wet" },
    ])).toBe("Mixed");
    expect(deriveFieldTestCondition([
      { lapTimeMs: 100_000, condition: "Mixed" },
    ])).toBe("Mixed");
  });

  it("limits Engineer support to reviewed Garage games", () => {
    expect(isEngineerGame("Assetto Corsa Competizione")).toBe(true);
    expect(isEngineerGame("Le Mans Ultimate")).toBe(true);
    expect(isEngineerGame("iRacing")).toBe(false);
  });
});
