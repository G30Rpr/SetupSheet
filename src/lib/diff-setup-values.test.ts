import { describe, expect, it } from "vitest";

import {
  buildComparisonDiff,
  diffSetupValues,
  diffTopLevelFields,
} from "@/lib/diff-setup-values";

describe("diffSetupValues", () => {
  it("flags no rows as differing when both sides are identical", () => {
    const values = { lfTirePressure: "23.5 psi", rfTirePressure: "23.5 psi" };
    const groups = diffSetupValues("iRacing", values, { ...values });
    const rows = groups.flatMap((g) => g.rows);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => !r.differs)).toBe(true);
  });

  it("flags rows where the two sides disagree", () => {
    const groups = diffSetupValues(
      "iRacing",
      { lfTirePressure: "23.5 psi" },
      { lfTirePressure: "24.0 psi" }
    );
    const row = groups.flatMap((g) => g.rows).find((r) => r.key === "lfTirePressure");
    expect(row).toMatchObject({ valueA: "23.5 psi", valueB: "24.0 psi", differs: true });
  });

  it("includes a field present on only one side, with the missing side as null", () => {
    const groups = diffSetupValues("iRacing", { crossWeight: "50.0%" }, {});
    const row = groups.flatMap((g) => g.rows).find((r) => r.key === "crossWeight");
    expect(row).toMatchObject({ valueA: "50.0%", valueB: null, differs: true });
  });

  it("omits fields that are blank on both sides", () => {
    const groups = diffSetupValues("iRacing", { lfTirePressure: "23.5 psi" }, {});
    const keys = groups.flatMap((g) => g.rows).map((r) => r.key);
    expect(keys).toEqual(["lfTirePressure"]);
  });

  it("omits groups left with no rows after filtering", () => {
    const groups = diffSetupValues("iRacing", { lfTirePressure: "23.5 psi" }, {});
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Tires & Alignment");
  });

  it("returns an empty result when both sides are null/undefined", () => {
    expect(diffSetupValues("iRacing", null, undefined)).toEqual([]);
  });

  it("uses the schema for the given game, so unrelated games' fields never appear", () => {
    const groups = diffSetupValues("Gran Turismo 7", { lfTirePressure: "23.5 psi" }, {});
    const keys = groups.flatMap((g) => g.rows).map((r) => r.key);
    expect(keys).not.toContain("lfTirePressure");
  });
});

const baseFields = {
  car: "BMW M4 GT3",
  track: "Spa-Francorchamps",
  condition: "Dry",
  lapTime: "2:19.104",
  description: "",
  tags: [] as string[],
  rigProfile: "Direct Drive + Load Cell",
};

describe("diffTopLevelFields", () => {
  it("returns nothing when nothing changed", () => {
    expect(diffTopLevelFields(baseFields, { ...baseFields })).toEqual([]);
  });

  it("reports only the fields that changed", () => {
    const changes = diffTopLevelFields(baseFields, { ...baseFields, track: "Monza" });
    expect(changes).toEqual([{ label: "Track", before: "Spa-Francorchamps", after: "Monza" }]);
  });

  it("joins tags for comparison so a reorder-free add/remove is detected", () => {
    const changes = diffTopLevelFields(baseFields, { ...baseFields, tags: ["Safe", "Race"] });
    expect(changes).toEqual([{ label: "Tags", before: "", after: "Safe, Race" }]);
  });
});

describe("buildComparisonDiff", () => {
  it("keeps only key-family rows that actually differ", () => {
    const groups = buildComparisonDiff(
      "iRacing",
      {
        lfTirePressure: "23.5 psi",
        frontArb: "3",
        crossWeight: "50.0%",
        frontSpring: "850 lbs/in",
      },
      {
        lfTirePressure: "23.5 psi", // key family but equal — dropped
        frontArb: "5", // key family, differs — kept
        crossWeight: "51.0%", // differs but not a key family — dropped
        frontSpring: "900 lbs/in", // differs but not a key family — dropped
      }
    );

    expect(groups.flatMap((g) => g.rows.map((r) => r.key))).toEqual(["frontArb"]);
  });

  it("covers the eight families and skips the diffuser brake-migration traps", () => {
    const groups = buildComparisonDiff(
      "Assetto Corsa Competizione",
      {
        rearWing: "5", // wing
        frontRideHeight: "60 mm", // ride height
        frontArb: "3", // ARB
        diffPreload: "50 Nm", // diff
        brakeBias: "54%", // brake bias
        abs: "3", // ABS
        tractionControl: "4", // TC
        frontLeftTyrePressure: "25.6 psi", // pressures
        frontDiffuser: "2", // NOT diff — aero trap
      },
      {
        rearWing: "7",
        frontRideHeight: "65 mm",
        frontArb: "4",
        diffPreload: "60 Nm",
        brakeBias: "56%",
        abs: "2",
        tractionControl: "5",
        frontLeftTyrePressure: "26.0 psi",
        frontDiffuser: "3",
      }
    );

    const keys = groups.flatMap((g) => g.rows.map((r) => r.key)).sort();
    expect(keys).toEqual(
      [
        "abs",
        "brakeBias",
        "diffPreload",
        "frontArb",
        "frontLeftTyrePressure",
        "frontRideHeight",
        "rearWing",
        "tractionControl",
      ].sort()
    );
  });

  it("still shows a one-sided key row, with the missing side as null", () => {
    const groups = buildComparisonDiff("iRacing", { rearAero: "9" }, {});
    const row = groups.flatMap((g) => g.rows).find((r) => r.key === "rearAero");
    expect(row).toMatchObject({ valueA: "9", valueB: null, differs: true });
  });

  it("returns nothing when the key values all match", () => {
    expect(
      buildComparisonDiff(
        "iRacing",
        { brakeBias: "48%", frontArb: "3" },
        { brakeBias: "48%", frontArb: "3" }
      )
    ).toEqual([]);
  });

  it("does not treat brake migration as brake bias", () => {
    expect(
      buildComparisonDiff(
        "Le Mans Ultimate",
        { brakeBias: "52%", brakeMigration: "0.1" },
        { brakeBias: "52%", brakeMigration: "0.3" }
      )
    ).toEqual([]);
  });
});
