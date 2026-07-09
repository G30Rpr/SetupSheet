import { describe, expect, it } from "vitest";

import { MAX_CAR_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_TRACK_LENGTH } from "@/lib/data";
import { validateSetupFields } from "@/lib/validate-setup-fields";

function validInput() {
  return {
    game: "iRacing",
    car: "Porsche 911 GT3 Cup",
    track: "Spa",
    condition: "Dry",
    description: "",
    rigProfile: "Wheel + 3 Pedals",
    tags: ["Safe"],
  };
}

describe("validateSetupFields", () => {
  it("returns null for valid input", () => {
    expect(validateSetupFields(validInput())).toBeNull();
  });

  it("rejects an unknown game", () => {
    expect(validateSetupFields({ ...validInput(), game: "Not A Game" })).toBe("Unknown game.");
  });

  it("rejects an unknown condition", () => {
    expect(validateSetupFields({ ...validInput(), condition: "Snowy" })).toBe(
      "Unknown condition."
    );
  });

  it("rejects an unknown rig profile", () => {
    expect(validateSetupFields({ ...validInput(), rigProfile: "Steering Wheel Only" })).toBe(
      "Unknown rig profile."
    );
  });

  it("rejects an unknown tag", () => {
    expect(validateSetupFields({ ...validInput(), tags: ["Not A Tag"] })).toBe("Unknown tag.");
  });

  it("rejects a car name over the max length", () => {
    const result = validateSetupFields({ ...validInput(), car: "x".repeat(MAX_CAR_LENGTH + 1) });
    expect(result).toBe(`Car name is too long — max ${MAX_CAR_LENGTH} characters.`);
  });

  it("accepts a car name at exactly the max length", () => {
    const result = validateSetupFields({ ...validInput(), car: "x".repeat(MAX_CAR_LENGTH) });
    expect(result).toBeNull();
  });

  it("rejects a track name over the max length", () => {
    const result = validateSetupFields({
      ...validInput(),
      track: "x".repeat(MAX_TRACK_LENGTH + 1),
    });
    expect(result).toBe(`Track name is too long — max ${MAX_TRACK_LENGTH} characters.`);
  });

  it("rejects a description over the max length", () => {
    const result = validateSetupFields({
      ...validInput(),
      description: "x".repeat(MAX_DESCRIPTION_LENGTH + 1),
    });
    expect(result).toBe(`Description is too long — max ${MAX_DESCRIPTION_LENGTH} characters.`);
  });

  it("returns only the first triggered message when multiple fields are invalid", () => {
    const result = validateSetupFields({
      ...validInput(),
      game: "Not A Game",
      condition: "Snowy",
    });
    expect(result).toBe("Unknown game.");
  });
});
