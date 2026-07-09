import { describe, expect, it } from "vitest";

import { parseAccSetupFile } from "@/lib/acc-setup-parser";

describe("parseAccSetupFile", () => {
  it("returns null for malformed JSON", () => {
    expect(parseAccSetupFile("{ not json")).toBeNull();
  });

  it("returns null for valid JSON missing basicSetup", () => {
    expect(parseAccSetupFile(JSON.stringify({ carName: "bmw_m4_gt3" }))).toBeNull();
  });

  it("returns null for a JSON array or primitive root", () => {
    expect(parseAccSetupFile(JSON.stringify([1, 2, 3]))).toBeNull();
    expect(parseAccSetupFile(JSON.stringify("just a string"))).toBeNull();
    expect(parseAccSetupFile(JSON.stringify(42))).toBeNull();
    expect(parseAccSetupFile(JSON.stringify(null))).toBeNull();
  });

  it("parses a minimal payload with an empty basicSetup", () => {
    const result = parseAccSetupFile(JSON.stringify({ basicSetup: {} }));
    expect(result).not.toBeNull();
    expect(result?.fieldCount).toBe(0);
    expect(result?.car).toBeNull();
  });

  it("maps a known carName to its display name", () => {
    const result = parseAccSetupFile(
      JSON.stringify({ carName: "bmw_m4_gt3", basicSetup: {} })
    );
    expect(result?.car).toBe("BMW M4 GT3 2021");
  });

  it("leaves car null for an unmapped carName without failing the parse", () => {
    const result = parseAccSetupFile(
      JSON.stringify({ carName: "bmw_m2_cs_racing", basicSetup: {} })
    );
    expect(result).not.toBeNull();
    expect(result?.car).toBeNull();
  });

  it("does not throw when advancedSetup is entirely absent", () => {
    const result = parseAccSetupFile(
      JSON.stringify({ carName: "bmw_m4_gt3", basicSetup: { electronics: { tC1: 3 } } })
    );
    expect(result?.setupValues.tractionControl).toBe("3");
    expect(result?.setupValues.rearWing).toBeUndefined();
  });

  it("extracts a realistic full payload", () => {
    const payload = {
      carName: "ferrari_296_gt3",
      basicSetup: {
        alignment: { staticCamber: [-3.2, -3.2, -2.7, -2.7] },
        electronics: { tC1: 4, tC2: 0, abs: 3, eCUMap: 8 },
        strategy: { fuel: 18, tyreCompound: 0, tyreSet: 0, frontBrakePadCompound: 0, rearBrakePadCompound: 1 },
        tyres: { tyreCompound: 0 },
      },
      advancedSetup: {
        mechanicalBalance: { aRBFront: 4, aRBRear: 4 },
        dampers: {
          bumpSlow: [12, 12, 8, 8],
          bumpFast: [6, 6, 4, 4],
          reboundSlow: [10, 10, 8, 8],
          reboundFast: [8, 8, 10, 10],
        },
        aeroBalance: { rearWing: 9, splitter: 0, brakeDuct: [3, 3] },
      },
    };

    const result = parseAccSetupFile(JSON.stringify(payload));
    expect(result?.car).toBe("Ferrari 296 GT3 2023");
    expect(result?.setupValues.frontLeftCamber).toBe("-3.20°");
    expect(result?.setupValues.rearRightCamber).toBe("-2.70°");
    expect(result?.setupValues.tractionControl).toBe("4");
    expect(result?.setupValues.abs).toBe("3");
    expect(result?.setupValues.engineMap).toBe("8");
    expect(result?.setupValues.fuel).toBe("18 L");
    expect(result?.setupValues.tyreCompound).toBe("Dry");
    // strategy.tyreSet/brakePadCompound are 0-indexed in the file, +1 on screen.
    expect(result?.setupValues.tyreSet).toBe("1");
    expect(result?.setupValues.frontBrakePadSet).toBe("1");
    expect(result?.setupValues.rearBrakePadSet).toBe("2");
    expect(result?.setupValues.frontArb).toBe("4");
    expect(result?.setupValues.rearArb).toBe("4");
    // Corner ordering: FL/FR/RL/RR.
    expect(result?.setupValues.frontLeftSlowBump).toBe("12");
    expect(result?.setupValues.frontRightSlowBump).toBe("12");
    expect(result?.setupValues.rearLeftSlowBump).toBe("8");
    expect(result?.setupValues.rearRightSlowBump).toBe("8");
    expect(result?.setupValues.frontLeftFastRebound).toBe("8");
    expect(result?.setupValues.rearRightFastRebound).toBe("10");
    expect(result?.setupValues.rearWing).toBe("9");
    expect(result?.setupValues.frontDiffuser).toBe("0");
    expect(result?.setupValues.frontBrakeDuct).toBe("3");
    expect(result?.setupValues.rearBrakeDuct).toBe("3");
  });
});
