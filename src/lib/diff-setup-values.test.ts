import { describe, expect, it } from "vitest";

import { diffSetupValues, diffTopLevelFields } from "@/lib/diff-setup-values";

describe("diffSetupValues", () => {
  it("flags no rows as differing when both sides are identical", () => {
    const values = { frontTirePressure: "23.5 psi", rearTirePressure: "24.0 psi" };
    const groups = diffSetupValues("iRacing", values, { ...values });
    const rows = groups.flatMap((g) => g.rows);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => !r.differs)).toBe(true);
  });

  it("flags rows where the two sides disagree", () => {
    const groups = diffSetupValues(
      "iRacing",
      { frontTirePressure: "23.5 psi" },
      { frontTirePressure: "24.0 psi" }
    );
    const row = groups.flatMap((g) => g.rows).find((r) => r.key === "frontTirePressure");
    expect(row).toMatchObject({ valueA: "23.5 psi", valueB: "24.0 psi", differs: true });
  });

  it("includes a field present on only one side, with the missing side as null", () => {
    const groups = diffSetupValues("iRacing", { crossWeight: "50.0%" }, {});
    const row = groups.flatMap((g) => g.rows).find((r) => r.key === "crossWeight");
    expect(row).toMatchObject({ valueA: "50.0%", valueB: null, differs: true });
  });

  it("omits fields that are blank on both sides", () => {
    const groups = diffSetupValues("iRacing", { frontTirePressure: "23.5 psi" }, {});
    const keys = groups.flatMap((g) => g.rows).map((r) => r.key);
    expect(keys).toEqual(["frontTirePressure"]);
  });

  it("omits groups left with no rows after filtering", () => {
    const groups = diffSetupValues("iRacing", { frontTirePressure: "23.5 psi" }, {});
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Tires & Chassis");
  });

  it("returns an empty result when both sides are null/undefined", () => {
    expect(diffSetupValues("iRacing", null, undefined)).toEqual([]);
  });

  it("uses the schema for the given game, so unrelated games' fields never appear", () => {
    const groups = diffSetupValues("Gran Turismo 7", { frontTirePressure: "23.5 psi" }, {});
    const keys = groups.flatMap((g) => g.rows).map((r) => r.key);
    expect(keys).not.toContain("frontTirePressure");
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
