import { describe, expect, it } from "vitest";

import { getEmptySetupValues, setupSchemas } from "@/lib/setup-schemas";
import { games } from "@/lib/data";

describe("getEmptySetupValues", () => {
  it("returns one empty-string entry per field, for every game", () => {
    for (const game of games) {
      const expectedKeys = setupSchemas[game].flatMap((group) =>
        group.fields.map((field) => field.key)
      );
      const values = getEmptySetupValues(game);

      expect(Object.keys(values).sort()).toEqual([...new Set(expectedKeys)].sort());
      for (const key of expectedKeys) {
        expect(values[key]).toBe("");
      }
    }
  });

  it("produces different key sets for different games", () => {
    const iRacingKeys = Object.keys(getEmptySetupValues("iRacing"));
    const gt7Keys = Object.keys(getEmptySetupValues("Gran Turismo 7"));
    expect(iRacingKeys).not.toEqual(gt7Keys);
  });
});
