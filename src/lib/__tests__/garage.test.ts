import { describe, expect, it } from "vitest";

import {
  parseCreateGarageLapInput,
  parseCreateGarageRevisionInput,
  parseCreateGarageRunPlanItemInput,
  parseCreateGarageSessionInput,
  parseLapTimeToMilliseconds,
} from "@/lib/garage";
import { getEmptySetupValues } from "@/lib/setup-schemas";

describe("Garage input validation", () => {
  it("accepts an ACC session with schema-backed baseline values", () => {
    const result = parseCreateGarageSessionInput({
      game: "Assetto Corsa Competizione",
      car: " BMW M4 GT3 ",
      track: " Monza ",
      condition: "Dry",
      rig: "Wheel + 3 Pedals",
      setupValues: getEmptySetupValues("Assetto Corsa Competizione"),
      baselineNote: "  baseline  ",
    });

    expect(result.error).toBeNull();
    expect(result.value).toMatchObject({
      game: "Assetto Corsa Competizione",
      car: "BMW M4 GT3",
      track: "Monza",
      baselineNote: "baseline",
    });

    const lmu = parseCreateGarageSessionInput({
      game: "Le Mans Ultimate",
      car: "Porsche 963",
      track: "Le Mans",
      condition: "Wet",
      rig: null,
      setupValues: getEmptySetupValues("Le Mans Ultimate"),
      baselineNote: "",
    });
    expect(lmu.error).toBeNull();
  });

  it("rejects unsupported games and setup keys outside that game's schema", () => {
    const base = {
      car: "Porsche 963",
      track: "Le Mans",
      condition: "Wet",
      rig: null,
      setupValues: { frontArb: "4" },
      baselineNote: "",
    };

    expect(parseCreateGarageSessionInput({ ...base, game: "Gran Turismo 7" }).error).toMatch(/supported game/i);
    expect(
      parseCreateGarageSessionInput({
        ...base,
        game: "Le Mans Ultimate",
        setupValues: { notARealField: "1" },
      }).error
    ).toMatch(/invalid for this game/i);
  });

  it("validates revision snapshots against the owning session's game schema", () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const valid = parseCreateGarageRevisionInput(
      { sessionId, setupValues: { brakeBias: "56%" }, note: "Revision two" },
      "Assetto Corsa Competizione"
    );
    expect(valid.error).toBeNull();
    expect(valid.value?.setupValues).toEqual({ brakeBias: "56%" });

    expect(parseCreateGarageRevisionInput(
      { sessionId, setupValues: { notARealField: "1" }, note: "" },
      "Assetto Corsa Competizione"
    ).value).toBeNull();
    expect(parseCreateGarageRevisionInput(
      { sessionId: "not-a-uuid", setupValues: {}, note: "" },
      "Le Mans Ultimate"
    ).value).toBeNull();
  });

  it("parses common lap-time formats and rejects malformed or unsafe values", () => {
    expect(parseLapTimeToMilliseconds("1:42.350")).toBe(102_350);
    expect(parseLapTimeToMilliseconds("0:59.9")).toBe(59_900);
    expect(parseLapTimeToMilliseconds("1:60.000")).toBeNull();
    expect(parseLapTimeToMilliseconds("-1:42.350")).toBeNull();
    expect(parseLapTimeToMilliseconds("1:42.1234")).toBeNull();
    expect(parseLapTimeToMilliseconds("this-is-way-too-long")).toBeNull();
    expect(parseLapTimeToMilliseconds("00:00.500")).toBeNull();
  });

  it("validates lap and run-plan relationships and enums before database writes", () => {
    const validIds = {
      sessionId: "11111111-1111-4111-8111-111111111111",
      revisionId: "22222222-2222-4222-8222-222222222222",
    };

    expect(parseCreateGarageLapInput({
      ...validIds,
      lapTime: "1:42.350",
      condition: "Dry",
      note: "clean lap",
    })).toMatchObject({ value: { lapTimeMs: 102_350 }, error: null });

    expect(parseCreateGarageLapInput({ ...validIds, lapTime: "nope", condition: "Dry", note: "" }).value).toBeNull();

    const runPlan = parseCreateGarageRunPlanItemInput({
      ...validIds,
      parameter: "Rear wing",
      direction: "increase",
      amount: "1 click",
      verdict: "better",
      note: "more stable in fast section",
    });
    expect(runPlan.error).toBeNull();
    expect(runPlan.value?.verdict).toBe("better");
    expect(parseCreateGarageRunPlanItemInput({
      ...validIds,
      parameter: "Rear wing",
      direction: "teleport",
      amount: "1 click",
      verdict: "better",
      note: "",
    }).value).toBeNull();
  });
});
